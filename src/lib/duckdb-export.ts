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

    geojson: (opts) => withConnection(async (conn, db) => {
        if (!opts.geometryColumn) {
            throw new Error('GeoJSON requires a geometry column');
        }
        await loadSpatial(conn);

        opts.onProgress?.({ stage: 'converting', message: 'Writing GeoJSON…' });
        const escaped = escapeSql(opts.parquetUrl);
        const virtualPath = `export_${Date.now()}.geojson`;
        await conn.query(`
            COPY (SELECT * FROM read_parquet('${escaped}'))
            TO '${virtualPath}' WITH (FORMAT GDAL, DRIVER 'GeoJSON')
        `);
        return bufferToBlob(db, virtualPath, EXPORT_FORMATS.geojson.mimeType);
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

    fgb: (opts) => withConnection(async (conn, db) => {
        if (!opts.geometryColumn) {
            throw new Error('FlatGeobuf requires a geometry column');
        }
        await loadSpatial(conn);

        opts.onProgress?.({ stage: 'converting', message: 'Writing FlatGeobuf…' });
        const escaped = escapeSql(opts.parquetUrl);
        const virtualPath = `export_${Date.now()}.fgb`;
        await conn.query(`
            COPY (SELECT * FROM read_parquet('${escaped}'))
            TO '${virtualPath}' WITH (FORMAT GDAL, DRIVER 'FlatGeobuf')
        `);
        return bufferToBlob(db, virtualPath, EXPORT_FORMATS.fgb.mimeType);
    }),
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
