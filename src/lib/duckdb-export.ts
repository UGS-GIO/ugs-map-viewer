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
import { EXPORT_FORMATS, type ExportFormat } from '@/lib/export-formats';
import { withConnection, loadSpatial, escapeSql, queryParquetDistinctValues } from '@/lib/duckdb/client';
import { downloadZip } from '@/lib/download-utils';
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
    /** Related tables configured on the layer (formation tops, geochemistry, etc). When
     * present + non-empty, `exportParquet` bundles them alongside the main file as a zip. */
    relatedTables?: RelatedTable[];
    onProgress?: (stage: ExportStage) => void;
}

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

// ── Per-format handlers ──────────────────────────────────────────────────────

type Handler = (opts: ExportOptions) => Promise<Blob>;

interface GeoJSONBuild {
    geojson: string;
    /** Non-geometry column names, in parquet order. */
    cols: string[];
    /** The subset of `cols` typed DOUBLE/FLOAT/REAL/DECIMAL in the source. */
    floatCols: string[];
}

// Builds the FeatureCollection in JS: duckdb-wasm's GDAL GeoJSON writer crashes
// ("Cannot write feature"), so we read geometry back as GeoJSON text plus property
// columns and assemble it here. Reprojects to 4326 for RFC 7946 — source is hardcoded
// EPSG:3857 (our current pipeline output); once parquets publish as 4326 this transform
// must go, else it double-projects. always_xy keeps lon/lat ordering; Force2D drops the
// spurious Z=0 the source carries on otherwise-2D geometry.
//
// Also the input to every gdal3.js conversion, which is why it reports column types:
// GDAL's GeoJSON reader infers Integer for a float column whose values happen to be
// whole, silently downcasting depth/elevation fields.
const buildGeoJSON = (opts: ExportOptions): Promise<GeoJSONBuild> => withConnection(async (conn) => {
    if (!opts.geometryColumn) {
        throw new Error('This format requires a geometry column');
    }
    await loadSpatial(conn);
    // Warehouse GeoParquet carries CRS metadata that spatial's GeoParquet reader chokes
    // on ("stoi: no conversion"), which otherwise fails the read outright. Disabling the
    // conversion hands us the raw WKB blob instead — and unlike reading before LOAD
    // spatial, it works no matter what already loaded the extension.
    await conn.query(`SET enable_geoparquet_conversion = false`);

    const escaped = escapeSql(opts.parquetUrl);
    const geomCol = opts.geometryColumn;

    const described = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${escaped}')`);
    const cols: string[] = [];
    const floatCols: string[] = [];
    let geomIsBlob = false;
    for (const row of described.toArray()) {
        const { column_name: name, column_type: type } = row.toJSON() as Record<string, unknown>;
        const col = String(name);
        const colType = String(type).toUpperCase();
        if (col === geomCol) {
            geomIsBlob = colType.includes('BLOB');
            continue;
        }
        cols.push(col);
        if (/DOUBLE|FLOAT|REAL|DECIMAL|NUMERIC/.test(colType)) floatCols.push(col);
    }
    const geom = geomIsBlob ? `ST_GeomFromWKB(${geomCol})` : geomCol;

    // Source CRS varies: legacy CDN parquets are EPSG:3857 (metres), warehouse ones are
    // OGC:CRS84 (degrees). Sniff rather than hardcode — transforming an already-4326
    // source double-projects it into the ocean. Longitude never exceeds 180, Web
    // Mercator easting is ~1e7, so the magnitude separates them unambiguously.
    const probe = await conn.query(`
        SELECT max(abs(ST_X(ST_Centroid(${geom})))) AS max_x
        FROM (SELECT ${geomCol} FROM read_parquet('${escaped}') WHERE ${geomCol} IS NOT NULL LIMIT 100)
    `);
    const maxX = Number((probe.toArray()[0]?.toJSON() as Record<string, unknown>)?.max_x ?? 0);
    const needsTransform = maxX > 180;
    // always_xy keeps lon/lat ordering; Force2D drops the spurious Z=0 some sources carry.
    const geom4326 = needsTransform
        ? `ST_Force2D(ST_Transform(${geom}, 'EPSG:3857', 'EPSG:4326', true))`
        : `ST_Force2D(${geom})`;

    const result = await conn.query(`
        SELECT
            ST_AsGeoJSON(${geom4326}) AS __g,
            * EXCLUDE (${geomCol})
        FROM read_parquet('${escaped}')
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

// gpkg / shp / gdb / fgb all take the same route: DuckDB builds the GeoJSON, gdal3.js
// writes the real format. The ~40MB GDAL payload is imported here so it only downloads
// when one of these is picked, and is memoized after the first use.
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
    // Direct pass-through — no DuckDB needed.
    parquet: async (opts) => {
        opts.onProgress?.({ stage: 'downloading', message: 'Fetching parquet…' });
        const res = await fetch(opts.parquetUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.blob();
    },

    geojson: async (opts) => {
        opts.onProgress?.({ stage: 'converting', message: 'Writing GeoJSON…' });
        const { geojson } = await buildGeoJSON(opts);
        return new Blob([geojson], { type: EXPORT_FORMATS.geojson.mimeType });
    },

    csv: (opts) => withConnection(async (conn, db) => {
        const escaped = escapeSql(opts.parquetUrl);
        const selectClause = opts.geometryColumn ? `* EXCLUDE (${opts.geometryColumn})` : '*';

        opts.onProgress?.({ stage: 'downloading', message: 'Fetching parquet…' });
        await conn.query(`
            CREATE OR REPLACE VIEW export_view AS
            SELECT ${selectClause} FROM read_parquet('${escaped}')
        `);

        opts.onProgress?.({ stage: 'converting', message: 'Writing CSV…' });
        const virtualPath = `export_${Date.now()}.csv`;
        await conn.query(`COPY export_view TO '${virtualPath}' (HEADER, DELIMITER ',')`);
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
): Promise<Record<string, string>> => {
    const files: Record<string, string> = {};
    const entryNames = uniqueEntryNames(relatedTables);
    await Promise.all(relatedTables.map(async (table, idx) => {
        if (!table.matchingField) return;
        try {
            let values: string[] = [];
            if (table.fetchMode !== 'parquet') {
                if (!table.targetField) return; // STAC-backed entry not yet resolved
                values = await queryParquetDistinctValues({ url: parquetUrl, field: table.targetField });
                if (values.length === 0) return;
            }
            const rows = await fetchRelatedRowsBulk(table, values);
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
        const relatedTables = opts.relatedTables ?? [];

        if (relatedTables.length === 0) {
            opts.onProgress?.({ stage: 'writing', message: 'Saving file…' });
            triggerDownload(blob, `${opts.filename}.${meta.extension}`);
            opts.onProgress?.({ stage: 'complete', message: 'Done' });
            return;
        }

        opts.onProgress?.({ stage: 'converting', message: 'Fetching related tables…' });
        const relatedFiles = await buildRelatedCsvFiles(opts.parquetUrl, relatedTables);

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
