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
    onProgress?: (stage: ExportStage) => void;
}

// ── DuckDB singleton (lazy, module-scoped) ───────────────────────────────────

let dbInstance: duckdb.AsyncDuckDB | null = null;
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

const initDuckDB = async (): Promise<duckdb.AsyncDuckDB> => {
    if (dbInstance) return dbInstance;
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
        const workerUrl = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
        );
        const worker = new Worker(workerUrl);
        const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);
        dbInstance = db;
        return db;
    })();

    return dbPromise;
};

/** Open a DuckDB connection for the duration of `fn`, always close it. */
const withConnection = async <T>(
    fn: (conn: duckdb.AsyncDuckDBConnection, db: duckdb.AsyncDuckDB) => Promise<T>,
): Promise<T> => {
    const db = await initDuckDB();
    const conn = await db.connect();
    try { return await fn(conn, db); }
    finally { await conn.close(); }
};

/** Load spatial extension on a connection. Idempotent. */
const loadSpatial = async (conn: duckdb.AsyncDuckDBConnection): Promise<void> => {
    await conn.query('INSTALL spatial');
    await conn.query('LOAD spatial');
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const escapeSql = (s: string): string => s.replace(/'/g, "''");

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

const handlers: Record<ExportFormat, Handler> = {
    // Direct pass-through — no DuckDB needed.
    parquet: async (opts) => {
        opts.onProgress?.({ stage: 'downloading', message: 'Fetching parquet…' });
        const res = await fetch(opts.parquetUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.blob();
    },

    // Build FeatureCollection in JS — duckdb-wasm's spatial GDAL GeoJSON writer
    // crashes ("Cannot write feature"), so we read rows back as geometry-as-GeoJSON
    // text plus property columns and assemble the FC manually. Reprojects to 4326
    // for RFC 7946. Source is hardcoded EPSG:3857 (our current pipeline output);
    // once parquets are published as 4326 this transform must be dropped, else it
    // double-projects. always_xy keeps lon/lat ordering; Force2D drops the
    // spurious Z=0 the source carries on otherwise-2D geometry.
    geojson: (opts) => withConnection(async (conn) => {
        if (!opts.geometryColumn) {
            throw new Error('GeoJSON requires a geometry column');
        }
        await loadSpatial(conn);

        opts.onProgress?.({ stage: 'converting', message: 'Writing GeoJSON…' });
        const escaped = escapeSql(opts.parquetUrl);
        const geom = opts.geometryColumn;
        const result = await conn.query(`
            SELECT
                ST_AsGeoJSON(ST_Force2D(ST_Transform(${geom}, 'EPSG:3857', 'EPSG:4326', true))) AS __g,
                * EXCLUDE (${geom})
            FROM read_parquet('${escaped}')
        `);

        const features: string[] = [];
        for (const row of result.toArray()) {
            const obj = row.toJSON() as Record<string, unknown>;
            const geomJson = obj.__g;
            delete obj.__g;
            features.push(`{"type":"Feature","geometry":${geomJson},"properties":${JSON.stringify(obj, jsonReplacer)}}`);
        }
        const fc = `{"type":"FeatureCollection","features":[${features.join(',')}]}`;
        return new Blob([fc], { type: EXPORT_FORMATS.geojson.mimeType });
    }),

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

};

// BIGINT columns arrive as JS bigint; JSON.stringify rejects them. Convert to
// Number when it round-trips losslessly, else String — keeps the file valid.
const jsonReplacer = (_key: string, value: unknown) => {
    if (typeof value !== 'bigint') return value;
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(value)
        : String(value);
};

// ── Public entrypoint ────────────────────────────────────────────────────────

export const exportParquet = async (opts: ExportOptions): Promise<void> => {
    const meta = EXPORT_FORMATS[opts.format];
    try {
        const blob = await handlers[opts.format](opts);
        opts.onProgress?.({ stage: 'writing', message: 'Saving file…' });
        triggerDownload(blob, `${opts.filename}.${meta.extension}`);
        opts.onProgress?.({ stage: 'complete', message: 'Done' });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        opts.onProgress?.({ stage: 'error', message });
        throw err;
    }
};
