/**
 * DuckDB-WASM singleton + connection helper shared by every consumer (export
 * pipeline, per-feature parquet hydration, future ad-hoc queries). One worker
 * instance per page so we don't pay the bundle-fetch cost twice.
 */
import * as duckdb from '@duckdb/duckdb-wasm'

let dbInstance: duckdb.AsyncDuckDB | null = null
let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

export const initDuckDB = async (): Promise<duckdb.AsyncDuckDB> => {
    if (dbInstance) return dbInstance
    if (dbPromise) return dbPromise

    dbPromise = (async () => {
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
        const workerUrl = URL.createObjectURL(
            new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }),
        )
        const worker = new Worker(workerUrl)
        const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker)
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
        URL.revokeObjectURL(workerUrl)
        dbInstance = db
        return db
    })()

    return dbPromise
}

/** Open a DuckDB connection for the duration of `fn`, always close it. */
export const withConnection = async <T>(
    fn: (conn: duckdb.AsyncDuckDBConnection, db: duckdb.AsyncDuckDB) => Promise<T>,
): Promise<T> => {
    const db = await initDuckDB()
    const conn = await db.connect()
    try {
        return await fn(conn, db)
    } finally {
        await conn.close()
    }
}

/** Load the spatial extension on a connection. Idempotent. */
export const loadSpatial = async (conn: duckdb.AsyncDuckDBConnection): Promise<void> => {
    await conn.query('INSTALL spatial')
    await conn.query('LOAD spatial')
}

export const escapeSql = (s: string): string => s.replace(/'/g, "''")
