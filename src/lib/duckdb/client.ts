/**
 * Shared DuckDB-WASM client — a single lazy, module-scoped instance reused across
 * the app (parquet export, related-table reads). Keep all duckdb init/connection
 * plumbing here so there's exactly one worker + instance.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import type { PostgRESTRow } from '@/lib/types/postgrest-types';

// ── DuckDB singleton (lazy, module-scoped) ───────────────────────────────────

let dbInstance: duckdb.AsyncDuckDB | null = null;
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export const initDuckDB = async (): Promise<duckdb.AsyncDuckDB> => {
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
export const withConnection = async <T>(
    fn: (conn: duckdb.AsyncDuckDBConnection, db: duckdb.AsyncDuckDB) => Promise<T>,
): Promise<T> => {
    const db = await initDuckDB();
    const conn = await db.connect();
    try { return await fn(conn, db); }
    finally { await conn.close(); }
};

/** Load spatial extension on a connection. Idempotent. */
export const loadSpatial = async (conn: duckdb.AsyncDuckDBConnection): Promise<void> => {
    await conn.query('INSTALL spatial');
    await conn.query('LOAD spatial');
};

// ── SQL helpers ──────────────────────────────────────────────────────────────

/** Escape a single-quoted SQL string literal. */
export const escapeSql = (s: string): string => s.replace(/'/g, "''");

/** Escape a double-quoted SQL identifier (column/table name). */
export const quoteIdent = (s: string): string => `"${s.replace(/"/g, '""')}"`;

// ── Row normalization ────────────────────────────────────────────────────────

/**
 * Arrow/duckdb returns int64 columns as JS bigint, which JSON.stringify rejects and
 * downstream String()/format/transform mishandle. Convert bigint to Number when it
 * round-trips losslessly, else String; pass everything else through. Produces the
 * plain row shape the popup pipeline expects.
 */
export const normalizeRow = (row: Record<string, unknown>): PostgRESTRow => {
    const out: PostgRESTRow = {};
    for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'bigint') {
            out[k] = v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)
                ? Number(v)
                : String(v);
        } else if (v === null || v === undefined) {
            out[k] = null;
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            out[k] = v;
        } else {
            out[k] = String(v);
        }
    }
    return out;
};

// ── Remote geoparquet reads ──────────────────────────────────────────────────

export interface ParquetByValuesOptions {
    /** Remote .parquet URL (read over httpfs with predicate pushdown). */
    url: string;
    /** Column in the parquet to filter/join on. */
    matchingField: string;
    /** Values to match (the visible features' join keys). Deduped before querying. */
    values: string[];
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

/**
 * Read a remote geoparquet, returning rows whose `matchingField` is in `values`.
 * duckdb-wasm fetches only the needed row groups via HTTP range requests. No spatial
 * extension — these are attribute tables.
 */
export const queryParquetByValues = async (
    { url, matchingField, values, sortBy, sortDirection }: ParquetByValuesOptions,
): Promise<PostgRESTRow[]> => {
    const unique = [...new Set(values)].filter(v => v !== '' && v != null);
    if (unique.length === 0) return [];

    return withConnection(async (conn) => {
        const inList = unique.map(v => `'${escapeSql(String(v))}'`).join(',');
        const order = sortBy
            ? ` ORDER BY ${quoteIdent(sortBy)} ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`
            : '';
        // Cast the join column to VARCHAR so string-quoted values match regardless of the
        // column's parquet type (e.g. uwi VARCHAR or box_pk INTEGER) — duckdb won't compare
        // INTEGER IN (VARCHAR…) without an explicit cast.
        const result = await conn.query(
            `SELECT * FROM read_parquet('${escapeSql(url)}') WHERE CAST(${quoteIdent(matchingField)} AS VARCHAR) IN (${inList})${order}`,
        );
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });
};

export interface ParquetAllOptions {
    /** Remote .parquet URL (read over httpfs). */
    url: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

/**
 * Read an entire remote geoparquet. Used by the layerlist "download whole layer +
 * related tables" path, where every row is wanted anyway — avoids building a giant
 * value-filtered query (which blows past URL limits for postgrest joins).
 */
export const queryParquetAll = async (
    { url, sortBy, sortDirection }: ParquetAllOptions,
): Promise<PostgRESTRow[]> => {
    return withConnection(async (conn) => {
        const order = sortBy
            ? ` ORDER BY ${quoteIdent(sortBy)} ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`
            : '';
        const result = await conn.query(
            `SELECT * FROM read_parquet('${escapeSql(url)}')${order}`,
        );
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });
};

/**
 * Read the distinct non-null values of one column from a remote geoparquet.
 * Used to seed a bulk related-table fetch (matchingField IN (...)) for a
 * whole-layer download, where there's no already-loaded feature set to draw
 * join keys from.
 */
export const queryParquetDistinctValues = async (
    { url, field }: { url: string; field: string },
): Promise<string[]> => {
    return withConnection(async (conn) => {
        const result = await conn.query(
            `SELECT DISTINCT CAST(${quoteIdent(field)} AS VARCHAR) AS v FROM read_parquet('${escapeSql(url)}') WHERE ${quoteIdent(field)} IS NOT NULL`,
        );
        return result.toArray()
            .map(r => (r.toJSON() as { v: unknown }).v)
            .filter((v): v is string => v != null)
            .map(String);
    });
};
