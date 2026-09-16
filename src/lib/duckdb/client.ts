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
        // Open the database so its runtime/filesystem config is initialised.
        // Without this, locally registered buffers still read fine, but remote
        // HTTP reads fail — `read_parquet` over https throws the unhelpful
        // "Invalid Error: stoi: no conversion". Instantiate alone does not do it.
        await db.open({});
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

// Spatial load state, keyed per instance so repeat calls skip a redundant
// INSTALL/LOAD round trip and concurrent callers share one load.
const spatialByDb = new WeakMap<duckdb.AsyncDuckDB, Promise<void>>();

/**
 * Install and load the spatial extension, once per database instance.
 *
 * `beforeLoad` runs first, on the same connection, and exists for one reason:
 * duckdb-wasm breaks `read_parquet` on any connection that runs `LOAD spatial`
 * before that connection has read a Parquet file — the later read then throws
 * "Invalid Error: stoi: no conversion". Reading the file once up front primes
 * the connection. Only the connection that actually triggers the load needs
 * this; later callers reuse the memo and never run `LOAD` themselves.
 *
 * The warm-up is best-effort: a failure here must not block spatial loading, so
 * it is warned and swallowed. A genuinely unreadable file surfaces its real
 * error on the read that follows.
 */
export const loadSpatial = async (
    conn: duckdb.AsyncDuckDBConnection,
    beforeLoad?: () => Promise<unknown>,
): Promise<void> => {
    const db = await initDuckDB();
    let promise = spatialByDb.get(db);
    if (!promise) {
        promise = (async () => {
            if (beforeLoad) {
                try {
                    await beforeLoad();
                } catch (e) {
                    console.warn('[duckdb] spatial warm-up failed (ignored):', e);
                }
            }
            await conn.query('INSTALL spatial');
            await conn.query('LOAD spatial');
        })();
        spatialByDb.set(db, promise);
    }
    try {
        await promise;
    } catch (e) {
        // Only clear the memo if it still points at this failed load, so a retry
        // another caller already succeeded with is not wiped out.
        if (spatialByDb.get(db) === promise) spatialByDb.delete(db);
        throw e;
    }
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
    sortBy?: string | string[];
    sortDirection?: 'asc' | 'desc';
}

/** `ORDER BY` clause for one or more keys, or '' when unsorted. */
const orderByClause = (sortBy: string | string[] | undefined, dir: 'asc' | 'desc' | undefined): string => {
    const keys = sortBy == null ? [] : Array.isArray(sortBy) ? sortBy : [sortBy];
    if (keys.length === 0) return '';
    // Per key: ASC/DESC binds to one expression, not the whole list.
    const sql = dir === 'desc' ? 'DESC' : 'ASC';
    return ` ORDER BY ${keys.map(k => `${quoteIdent(k)} ${sql}`).join(', ')}`;
};

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
        const order = orderByClause(sortBy, sortDirection);
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
    sortBy?: string | string[];
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
        const order = orderByClause(sortBy, sortDirection);
        const result = await conn.query(
            `SELECT * FROM read_parquet('${escapeSql(url)}')${order}`,
        );
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });
};

// ── Materialized attribute tables ────────────────────────────────────────────

/**
 * Remote parquet columns, pulled into DuckDB once per (url, columns) per session.
 *
 * Interactive paths — typeahead search, filter option lists, range sliders — re-run the
 * same shape of query as the user types or clicks. Against a remote file each of those is
 * an HTTP read of the relevant column chunks, so the cost is paid again on every
 * keystroke or checkbox. The attribute columns are small next to the geometry, so one
 * up-front read makes every later query local. Geometry stays remote and is fetched by id
 * only when something actually needs it.
 *
 * Returns a SQL table expression for the FROM clause — the materialized table when it
 * could be built, otherwise `read_parquet(...)` so callers keep working either way.
 */
const attributeTables = new Map<string, Promise<string>>();

const attributeTableName = (key: string): string => {
    const hash = [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
    return `attrs_${(hash >>> 0).toString(36)}`;
};

export const materializedAttributes = async (
    { url, columns, expressions, geometryField = 'geom' }: {
        url: string;
        columns?: string[];
        /**
         * Extra projected columns as `alias -> SQL expression`, materialized alongside the
         * plain ones so a search can filter and order on them like any other column. The
         * expressions are caller-authored SQL (never user input) and are interpolated as
         * written; the alias is quoted.
         */
        expressions?: Record<string, string>;
        geometryField?: string;
    },
): Promise<string> => {
    const remote = `read_parquet('${escapeSql(url)}')`;
    const derived = Object.entries(expressions ?? {});
    const key = `${url}::${columns?.join(',') ?? `*-${geometryField}`}::${derived.map(([a, e]) => `${a}=${e}`).join(',')}`;
    const cached = attributeTables.get(key);
    if (cached) return cached;

    const building = (async () => {
        const table = attributeTableName(key);
        const base = columns?.length
            ? columns.map(quoteIdent).join(', ')
            // EXCLUDE errors if the column isn't there, so only exclude what the file has.
            : await withConnection(async (conn) => {
                const described = await conn.query(`DESCRIBE SELECT * FROM ${remote}`);
                const names = described.toArray().map(r => String((r.toJSON() as Record<string, unknown>).column_name));
                return names.includes(geometryField) ? `* EXCLUDE (${quoteIdent(geometryField)})` : '*';
            });
        const projection = derived.length
            ? `${base}, ${derived.map(([alias, expr]) => `${expr} AS ${quoteIdent(alias)}`).join(', ')}`
            : base;

        await withConnection(async (conn) => {
            await conn.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} AS SELECT ${projection} FROM ${remote}`);
        });
        return quoteIdent(table);
    })();

    // A failed build shouldn't poison the session — drop it so the next call retries,
    // and fall back to reading the file directly meanwhile.
    building.catch(() => attributeTables.delete(key));
    attributeTables.set(key, building);

    try {
        return await building;
    } catch (err) {
        // The raw file can't bind derived aliases, so falling back there turns a broken
        // projection into a silent empty result. Surface it instead.
        if (derived.length) throw err;
        console.warn(`[materializedAttributes] falling back to ${remote}:`, err);
        return remote;
    }
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

/** Value → row count for one column. `splitCommaDelimited` counts each comma-separated token. */
export const queryParquetFieldOptions = async (
    { url, field, predicates = [], splitCommaDelimited = false }:
        { url: string; field: string; predicates?: string[]; splitCommaDelimited?: boolean },
): Promise<{ options: string[]; counts: Record<string, number> }> => {
    const col = quoteIdent(field);
    const where = [`${col} IS NOT NULL`, `CAST(${col} AS VARCHAR) <> ''`, ...predicates].join(' AND ');
    const value = splitCommaDelimited
        ? `TRIM(UNNEST(string_split(CAST(${col} AS VARCHAR), ',')))`
        : `TRIM(CAST(${col} AS VARCHAR))`;

    const from = await materializedAttributes({ url });

    return withConnection(async (conn) => {
        const result = await conn.query(`
            SELECT v, COUNT(*) AS n FROM (
                SELECT ${value} AS v FROM ${from} WHERE ${where}
            ) WHERE v <> '' GROUP BY v ORDER BY n DESC, v ASC
        `);
        const options: string[] = [];
        const counts: Record<string, number> = {};
        for (const row of result.toArray()) {
            const { v, n } = row.toJSON() as { v: unknown; n: unknown };
            if (v == null) continue;
            options.push(String(v));
            counts[String(v)] = Number(n);
        }
        return { options, counts };
    });
};

/** Global min/max of a numeric column, for a range slider's rails. */
export const queryParquetFieldExtent = async (
    { url, field }: { url: string; field: string },
): Promise<{ min: number; max: number }> => {
    const col = quoteIdent(field);
    const from = await materializedAttributes({ url });
    return withConnection(async (conn) => {
        const result = await conn.query(
            `SELECT MIN(${col}) AS lo, MAX(${col}) AS hi FROM ${from} WHERE ${col} IS NOT NULL`,
        );
        const { lo, hi } = (result.toArray()[0]?.toJSON() ?? {}) as { lo: unknown; hi: unknown };
        return { min: Number(lo ?? 0), max: Number(hi ?? 0) };
    });
};
