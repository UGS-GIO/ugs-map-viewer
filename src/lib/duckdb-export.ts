/**
 * DuckDB-WASM based GeoParquet export utility.
 *
 * Fetches a remote parquet, converts client-side to the requested format via
 * DuckDB-WASM's HTTPFS + spatial extension, writes the result to a browser
 * download. No backend involved.
 *
 * The geometry column (if any) is passed in by the caller — typically
 * discovered via the lightweight `useParquetSchema` hook that reads the
 * parquet footer only. Avoids re-probing inside DuckDB.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import type { FilterSpecification } from 'maplibre-gl';
import { EXPORT_FORMATS, isCombinedTable, uniqueColumnName, type ExportFormat } from '@/lib/export-formats';
import { withConnection, loadSpatial, escapeSql, quoteIdent, queryParquetDistinctValues } from '@/lib/duckdb/client';
import { downloadZip } from '@/lib/download-utils';
import { isInternalColumn } from '@/lib/export-fields';
import { fetchRelatedRowsBulk, relatedRowsToCsv } from '@/lib/related-table-fetch';
import type { RelatedTable } from '@/lib/types/mapping-types';

export type { ExportFormat } from '@/lib/export-formats';
export { safeFilename } from '@/lib/export-formats';

export interface ExportStage {
    stage: 'init' | 'downloading' | 'converting' | 'writing' | 'complete' | 'error';
    message: string;
}

export interface ExportOptions {
    parquetUrl: string;
    /** Filename without extension */
    filename: string;
    format: ExportFormat;
    /** Geometry column name if present, else null — discovered via useParquetSchema */
    geometryColumn: string | null;
    /** Output CRS for the gdal formats (shp/gpkg/gdb/fgb). Defaults to 4326. */
    epsg?: number;
    /** Source CRS of the GeoParquet (e.g. "EPSG:26712") when not WGS84; populated from STAC `proj:code`. */
    sourceCrs?: string;
    /** Optional MapLibre layer `featureFilter` applied as a SQL WHERE clause so derivative layers export only matching rows. */
    featureFilter?: FilterSpecification;
    /** Related tables configured on the layer (formation tops, geochemistry, etc). When
     * present + non-empty, `exportParquet` bundles them alongside the main file as a zip. */
    relatedTables?: RelatedTable[];
    onProgress?: (stage: ExportStage) => void;
}

const EPSG_RE = /^EPSG:\d+$/i;
const WGS84_CODES = new Set(['EPSG:4326', 'OGC:CRS84', 'CRS:84']);

/**
 * Warehouse CRS metadata makes spatial's GeoParquet reader throw "stoi: no conversion".
 * Disable it whenever spatial is loaded in the shared DuckDB instance; ignore when spatial
 * has not been loaded yet (parameter does not exist).
 */
const disableGeoParquetRead = async (conn: duckdb.AsyncDuckDBConnection): Promise<void> => {
    try {
        await conn.query(`SET enable_geoparquet_conversion = false`);
    } catch {
        // Spatial extension not loaded in this session — nothing to disable.
    }
};

/**
 * Resolve the source CRS to reproject from, or null when already WGS84.
 * Prefers authoritative STAC `proj:code`; falls back to probing easting magnitude
 * for legacy Web Mercator parquets without CRS metadata.
 */
const resolveTransformFrom = async (
    conn: duckdb.AsyncDuckDBConnection,
    opts: ExportOptions,
    geomExpr: string,
    geomCol: string,
): Promise<string | null> => {
    const explicitCrs = opts.sourceCrs?.trim().toUpperCase();
    if (explicitCrs) {
        if (WGS84_CODES.has(explicitCrs)) return null;
        if (EPSG_RE.test(explicitCrs)) return explicitCrs;
        console.warn(`[exportParquet] unrecognized sourceCrs '${opts.sourceCrs}', falling back to coordinate probe`);
    }
    const probe = await conn.query(`
        SELECT max(abs(ST_X(ST_Centroid(${geomExpr})))) AS max_x
        FROM (SELECT ${geomCol} FROM read_parquet('${escapeSql(opts.parquetUrl)}') WHERE ${geomCol} IS NOT NULL LIMIT 100)
    `);
    const maxX = Number((probe.toArray()[0]?.toJSON() as Record<string, unknown>)?.max_x ?? 0);
    return maxX > 180 ? 'EPSG:3857' : null;
};

const sqlLiteral = (val: unknown): string => {
    if (val == null) return 'NULL';
    if (typeof val === 'string') return `'${escapeSql(val)}'`;
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    throw new Error(`Unsupported filter literal in export: ${JSON.stringify(val)}`);
};

const isNull = (e: unknown): boolean => e == null || (Array.isArray(e) && e[0] === 'literal' && e[1] == null);

// Only the operators layer `featureFilter`s use; anything else throws so an export never comes out unfiltered.
const compileExpr = (expr: unknown): string => {
    if (!Array.isArray(expr)) return sqlLiteral(expr);
    const [op, ...args] = expr;
    const fail = (): never => { throw new Error(`Unsupported filter in export: ${JSON.stringify(expr)}`); };
    // A bare property name is legacy filter syntax; as a literal it would silently match nothing.
    if (['==', '!=', 'in'].includes(op) && typeof args[0] === 'string') fail();
    switch (op) {
        case 'get':
        case 'has':
            if (typeof args[0] !== 'string' || args.length !== 1) return fail();
            return op === 'get' ? quoteIdent(args[0]) : `(${quoteIdent(args[0])} IS NOT NULL)`;
        case 'literal':
            return sqlLiteral(args[0]);
        case 'to-string':
            return `COALESCE(CAST(${compileExpr(args[0])} AS VARCHAR), '')`;
        case 'downcase':
            return `LOWER(${compileExpr(args[0])})`;
        case '!':
            return `(NOT COALESCE(${compileExpr(args[0])}, FALSE))`;
        case 'all':
        case 'any':
            if (args.length === 0) return op === 'all' ? 'TRUE' : 'FALSE';
            return `(${args.map(compileExpr).join(op === 'all' ? ' AND ' : ' OR ')})`;
        case '==':
        case '!=': {
            const [lhs, rhs] = args;
            if (isNull(lhs) || isNull(rhs)) {
                return `(${compileExpr(isNull(rhs) ? lhs : rhs)} ${op === '==' ? 'IS NULL' : 'IS NOT NULL'})`;
            }
            return `(${compileExpr(lhs)} ${op === '==' ? '=' : 'IS DISTINCT FROM'} ${compileExpr(rhs)})`;
        }
        case 'in': {
            const [needle, haystack] = args;
            if (!Array.isArray(haystack) || haystack[0] !== 'literal' || !Array.isArray(haystack[1])) return fail();
            const items: unknown[] = haystack[1];
            return items.length === 0 ? 'FALSE' : `(${compileExpr(needle)} IN (${items.map(sqlLiteral).join(', ')}))`;
        }
        default:
            return fail();
    }
};

/** Compile a layer `featureFilter` into a DuckDB `WHERE` predicate. */
export const maplibreFilterToSql = (filter: FilterSpecification): string =>
    typeof filter === 'boolean' ? (filter ? 'TRUE' : 'FALSE') : compileExpr(filter);

// ── Helpers ──────────────────────────────────────────────────────────────────

const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/** Materialize a DuckDB virtual file into a Blob and clean up. Handles SharedArrayBuffer-backed results. */
let exportSeq = 0;
/** Unique per page session: two concurrent exports must not share a path in the WASM filesystem. */
const virtualExportPath = (extension: string): string => `export_${Date.now()}_${exportSeq++}.${extension}`;

const bufferToBlob = async (
    db: duckdb.AsyncDuckDB,
    virtualPath: string,
    mimeType: string,
): Promise<Blob> => {
    const buffer = await db.copyFileToBuffer(virtualPath);
    await db.dropFile(virtualPath);
    // Copy into fresh ArrayBuffer so Blob accepts regardless of underlying buffer kind
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return new Blob([bytes], { type: mimeType });
};

const combinedTables = (opts: ExportOptions): RelatedTable[] =>
    (opts.relatedTables ?? []).filter(isCombinedTable);

const columnNames = async (conn: duckdb.AsyncDuckDBConnection, relation: string): Promise<string[]> => {
    const described = await conn.query(`DESCRIBE SELECT * FROM ${relation}`);
    return described.toArray().flatMap(row => {
        const json: unknown = row.toJSON();
        if (json === null || typeof json !== 'object') return [];
        const name = Reflect.get(json, 'column_name');
        return typeof name === 'string' ? [name] : [];
    });
};

/**
 * The relation every format reads from: the layer's parquet, LEFT JOINed to each
 * `combineIntoExport` table so its fields ride along on the row. A well with three
 * sample intervals comes out as three rows; one with none keeps its row with blanks.
 * A related field whose name the layer already uses is prefixed with the table's label.
 */
export const joinedRelationSql = (
    main: string,
    mainColumns: string[],
    tables: RelatedTable[],
): string => {
    const taken = new Set(mainColumns);
    const selects = ['m.*'];
    const joins: string[] = [];
    const order: string[] = [];

    tables.forEach((table, idx) => {
        const { url, matchingField, targetField, displayFields, fieldLabel, sortBy } = table;
        if (!url || !matchingField || !targetField) return;
        const alias = `r${idx}`;
        if (order.length === 0) order.push(`m.${quoteIdent(targetField)}`);

        for (const { field } of displayFields ?? []) {
            if (!field || isInternalColumn(field)) continue;
            selects.push(`${alias}.${quoteIdent(field)} AS ${quoteIdent(uniqueColumnName(field, fieldLabel, taken))}`);
        }
        joins.push(
            `LEFT JOIN read_parquet('${escapeSql(url)}') AS ${alias}` +
            ` ON m.${quoteIdent(targetField)} = ${alias}.${quoteIdent(matchingField)}`,
        );
        for (const key of [sortBy ?? []].flat()) order.push(`${alias}.${quoteIdent(key)}`);
    });

    if (joins.length === 0) return main;
    return `(SELECT ${selects.join(', ')} FROM ${main} AS m ${joins.join(' ')} ORDER BY ${order.join(', ')})`;
};

const exportSource = async (conn: duckdb.AsyncDuckDBConnection, opts: ExportOptions): Promise<string> => {
    let main = `read_parquet('${escapeSql(opts.parquetUrl)}')`;
    if (opts.featureFilter !== undefined) {
        main = `(SELECT * FROM ${main} WHERE ${maplibreFilterToSql(opts.featureFilter)})`;
    }
    const tables = combinedTables(opts);
    if (tables.length === 0) return main;
    return joinedRelationSql(main, await columnNames(conn, main), tables);
};

// ── Per-format handlers ──────────────────────────────────────────────────────

type Handler = (opts: ExportOptions) => Promise<Blob>;

/** `EXCLUDE (...)` list for a parquet's geometry + internal columns, or '' when there's nothing to drop. */
const excludeClause = (dropped: string[]): string =>
    dropped.length ? ` EXCLUDE (${dropped.map(quoteIdent).join(', ')})` : '';

interface GeoJSONBuild {
    geojson: string;
    /** Non-geometry column names, in parquet order. */
    cols: string[];
    /** The subset of `cols` typed DOUBLE/FLOAT/REAL/DECIMAL in the source. */
    floatCols: string[];
}

// Assembled in JS because duckdb-wasm's GDAL GeoJSON writer crashes. Output is 4326
// per RFC 7946, and is also the input to every gdal3.js conversion — hence the column
// types, which stop GDAL downcasting whole-valued floats to Integer.
const buildGeoJSON = (opts: ExportOptions): Promise<GeoJSONBuild> => withConnection(async (conn) => {
    if (!opts.geometryColumn) {
        throw new Error('This format requires a geometry column');
    }
    await loadSpatial(conn);
    // Warehouse CRS metadata makes spatial's GeoParquet reader throw "stoi: no conversion".
    // Disabling it yields raw WKB, and works whatever already loaded the extension.
    await conn.query(`SET enable_geoparquet_conversion = false`);

    const source = await exportSource(conn, opts);
    const geomCol = opts.geometryColumn;

    const described = await conn.query(`DESCRIBE SELECT * FROM ${source}`);
    const cols: string[] = [];
    const floatCols: string[] = [];
    const dropped: string[] = [geomCol];
    let geomIsBlob = false;
    for (const row of described.toArray()) {
        const { column_name: name, column_type: type } = row.toJSON() as Record<string, unknown>;
        const col = String(name);
        const colType = String(type).toUpperCase();
        if (col === geomCol) {
            geomIsBlob = colType.includes('BLOB');
            continue;
        }
        if (isInternalColumn(col)) {
            dropped.push(col);
            continue;
        }
        cols.push(col);
        if (/DOUBLE|FLOAT|REAL|DECIMAL|NUMERIC/.test(colType)) floatCols.push(col);
    }
    const quotedGeomCol = quoteIdent(geomCol);
    const geom = geomIsBlob ? `ST_GeomFromWKB(${quotedGeomCol})` : quotedGeomCol;
    const transformFrom = await resolveTransformFrom(conn, opts, geom, quotedGeomCol);
    // always_xy keeps lon/lat order; Force2D drops the spurious Z=0 some sources carry.
    const geom4326 = transformFrom
        ? `ST_Force2D(ST_Transform(${geom}, '${transformFrom}', 'EPSG:4326', true))`
        : `ST_Force2D(${geom})`;

    const result = await conn.query(`
        SELECT
            ST_AsGeoJSON(${geom4326}) AS __g,
            *${excludeClause(dropped)}
        FROM ${source}
    `);

    const features: string[] = [];
    for (const row of result.toArray()) {
        const obj = row.toJSON() as Record<string, unknown>;
        const geomJson = obj.__g;
        delete obj.__g;
        features.push(`{"type":"Feature","geometry":${geomJson},"properties":${JSON.stringify(obj, jsonReplacer)}}`);
    }
    return { geojson: `{"type":"FeatureCollection","features":[${features.join(',')}]}`, cols, floatCols };
});

// DuckDB builds the GeoJSON, gdal3.js writes the real format. Imported here so its
// ~40MB only downloads when one of these formats is picked.
const gdalHandler = (format: ExportFormat): Handler => async (opts) => {
    opts.onProgress?.({ stage: 'converting', message: 'Reading features…' });
    const { geojson, cols, floatCols } = await buildGeoJSON(opts);

    opts.onProgress?.({ stage: 'converting', message: `Writing ${EXPORT_FORMATS[format].label}…` });
    const { convertGeoJSON, GDAL_TARGETS } = await import('@/lib/gdal-export');
    const { bytes, mime } = await convertGeoJSON(
        geojson,
        opts.filename,
        GDAL_TARGETS[format],
        opts.epsg ?? 4326,
        cols,
        floatCols,
    );
    // Copy into a fresh ArrayBuffer so Blob accepts it regardless of the underlying buffer kind.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new Blob([copy], { type: mime });
};

const handlers: Record<ExportFormat, Handler> = {
    // Direct pass-through — no DuckDB needed unless combining tables or applying a featureFilter.
    parquet: async (opts) => {
        if (combinedTables(opts).length === 0 && opts.featureFilter === undefined) {
            opts.onProgress?.({ stage: 'downloading', message: 'Fetching parquet…' });
            const res = await fetch(opts.parquetUrl);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            return res.blob();
        }
        return withConnection(async (conn, db) => {
            opts.onProgress?.({ stage: 'converting', message: opts.featureFilter !== undefined ? 'Filtering features…' : 'Combining tables…' });
            // Rows keep the source CRS, same as the unfiltered pass-through.
            await disableGeoParquetRead(conn);
            const source = await exportSource(conn, opts);
            const virtualPath = virtualExportPath('parquet');
            await conn.query(`COPY (SELECT * FROM ${source}) TO '${virtualPath}' (FORMAT PARQUET)`);
            return bufferToBlob(db, virtualPath, EXPORT_FORMATS.parquet.mimeType);
        });
    },

    geojson: async (opts) => {
        opts.onProgress?.({ stage: 'converting', message: 'Writing GeoJSON…' });
        const { geojson } = await buildGeoJSON(opts);
        return new Blob([geojson], { type: EXPORT_FORMATS.geojson.mimeType });
    },

    csv: (opts) => withConnection(async (conn, db) => {
        await disableGeoParquetRead(conn);
        opts.onProgress?.({ stage: 'downloading', message: 'Fetching parquet…' });
        const source = await exportSource(conn, opts);
        const dropped = (await columnNames(conn, source))
            .filter(col => col === opts.geometryColumn || isInternalColumn(col));

        opts.onProgress?.({ stage: 'converting', message: 'Writing CSV…' });
        const virtualPath = virtualExportPath('csv');
        // Straight from a subquery: a named view is global, so two exports at once would collide.
        await conn.query(
            `COPY (SELECT *${excludeClause(dropped)} FROM ${source}) TO '${virtualPath}' (HEADER, DELIMITER ',')`,
        );
        return bufferToBlob(db, virtualPath, EXPORT_FORMATS.csv.mimeType);
    }),

    gpkg: gdalHandler('gpkg'),
    shp: gdalHandler('shp'),
    gdb: gdalHandler('gdb'),
    fgb: gdalHandler('fgb'),
};

// BIGINT columns arrive as JS bigint; JSON.stringify rejects them. Convert to
// Number when it round-trips losslessly, else String — keeps the file valid.
const jsonReplacer = (_key: string, value: unknown) => {
    if (typeof value !== 'bigint') return value;
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(value)
        : String(value);
};

// Sanitize a related table's fieldLabel into a safe zip entry name.
const safeEntryName = (s: string): string =>
    s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'related';

// Unique `related-<name>.csv` stem per table, resolved synchronously up front so
// two tables with the same (or empty) fieldLabel don't collide to one zip entry.
// Deterministic and race-free — computed before the concurrent fetch below.
const uniqueEntryNames = (relatedTables: RelatedTable[]): string[] => {
    const used = new Set<string>();
    return relatedTables.map((t, idx) => {
        const base = safeEntryName(t.fieldLabel || `table-${idx + 1}`);
        let name = base;
        for (let n = 2; used.has(name); n++) name = `${base}-${n}`;
        used.add(name);
        return name;
    });
};

/**
 * Fetch every configured related table for the full layer (not just visible
 * features).
 *
 * - parquet related assets are read whole (already scoped to the STAC item), so
 *   we skip the distinct-key scan entirely — reading the main parquet's join
 *   column just to feed a filter we don't use would be pure waste.
 * - postgrest/wfs tables may be shared across datasets, so we pull the layer's
 *   distinct join keys (once, for that table's targetField) and chunk-filter.
 *
 * Each table is isolated: one that errors (bad URL, CORS, server cap) is logged
 * and skipped so the main file and the other related tables still download.
 */
const buildRelatedCsvFiles = async (
    parquetUrl: string,
    relatedTables: RelatedTable[],
    featureFilter?: FilterSpecification,
): Promise<Record<string, string>> => {
    const files: Record<string, string> = {};
    const entryNames = uniqueEntryNames(relatedTables);
    const whereSql = featureFilter !== undefined ? maplibreFilterToSql(featureFilter) : null;
    await Promise.all(relatedTables.map(async (table, idx) => {
        if (!table.matchingField) return;
        try {
            let values: string[] = [];
            if (table.fetchMode !== 'parquet' || whereSql) {
                const targetField = table.targetField;
                if (!targetField) return; // STAC-backed entry not yet resolved
                if (whereSql) {
                    values = await withConnection(async (conn) => {
                        await disableGeoParquetRead(conn);
                        const col = quoteIdent(targetField);
                        const res = await conn.query(
                            `SELECT DISTINCT CAST(${col} AS VARCHAR) AS v FROM read_parquet('${escapeSql(parquetUrl)}') WHERE (${whereSql}) AND ${col} IS NOT NULL`,
                        );
                        return res.toArray().flatMap(r => {
                            const v = Reflect.get(r.toJSON() as object, 'v');
                            return typeof v === 'string' ? [v] : [];
                        });
                    });
                } else {
                    values = await queryParquetDistinctValues({ url: parquetUrl, field: targetField });
                }
                if (values.length === 0) return;
            }
            let rows = await fetchRelatedRowsBulk(table, values);
            if (whereSql && table.fetchMode === 'parquet') {
                // `fetchRelatedRowsBulk` reads parquet assets whole; filter to the matched parent keys.
                const allowed = new Set(values);
                const matchCol = table.matchingField;
                rows = rows.filter(r => r[matchCol] != null && allowed.has(String(r[matchCol])));
            }
            if (rows.length === 0) return;
            files[`related-${entryNames[idx]}.csv`] = relatedRowsToCsv(rows, table);
        } catch (err) {
            console.error(`[exportParquet] related table '${table.fieldLabel ?? idx}' failed, skipping:`, err);
        }
    }));
    return files;
};

// ── Public entrypoint ────────────────────────────────────────────────────────

export const exportParquet = async (opts: ExportOptions): Promise<void> => {
    const meta = EXPORT_FORMATS[opts.format];
    try {
        const blob = await handlers[opts.format](opts);
        // One flagged `combineIntoExport` but not parquet-backed still ships as its own CSV.
        const relatedTables = (opts.relatedTables ?? []).filter(t => !isCombinedTable(t));

        if (relatedTables.length === 0) {
            opts.onProgress?.({ stage: 'writing', message: 'Saving file…' });
            triggerDownload(blob, `${opts.filename}.${meta.extension}`);
            opts.onProgress?.({ stage: 'complete', message: 'Done' });
            return;
        }

        opts.onProgress?.({ stage: 'converting', message: 'Fetching related tables…' });
        const relatedFiles = await buildRelatedCsvFiles(opts.parquetUrl, relatedTables, opts.featureFilter);

        opts.onProgress?.({ stage: 'writing', message: 'Saving files…' });
        if (Object.keys(relatedFiles).length === 0) {
            // No related rows matched — fall back to a single-file download rather
            // than a zip with only the main file.
            triggerDownload(blob, `${opts.filename}.${meta.extension}`);
        } else {
            const mainBytes = new Uint8Array(await blob.arrayBuffer());
            downloadZip({ [`${opts.filename}.${meta.extension}`]: mainBytes, ...relatedFiles }, opts.filename);
        }
        opts.onProgress?.({ stage: 'complete', message: 'Done' });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        opts.onProgress?.({ stage: 'error', message });
        throw err;
    }
};
