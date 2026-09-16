import type { FeatureCollection, Feature } from 'geojson'
import { withConnection, loadSpatial, escapeSql, quoteIdent, normalizeRow } from '@/lib/duckdb/client'
import { readGeoParquetCrs, reprojectToWgs84, assertGeographicBounds } from '@/lib/map/user-layers/geoparquet-crs'

/** The slice of an `AsyncDuckDBConnection` this module uses. */
type DuckDbRow = { toJSON: () => unknown }
type DuckDbResult = { toArray: () => DuckDbRow[]; numRows?: number }
type DuckDbConnection = {
    /** Materializes the whole result in the WASM heap — small results only. */
    query: (sql: string) => Promise<DuckDbResult>
    /** Streams the result a record batch at a time. Required for anything row-unbounded. */
    send?: (sql: string) => Promise<AsyncIterable<DuckDbResult>>
}

/**
 * Iterate a query's rows without materializing the whole result.
 *
 * `conn.query` builds the entire Arrow result as one contiguous buffer in
 * DuckDB's 32-bit WASM heap before handing it over. For a row-unbounded read —
 * every polygon's GeoJSON text, say — that single allocation is the thing that
 * dies as "malloc of size N failed", long before the browser is out of memory.
 * `conn.send` hands back record batches instead, so only one batch is live at a
 * time. Falls back to `query` where `send` is unavailable (notably in tests).
 */
async function* streamRows(conn: DuckDbConnection, sql: string): AsyncGenerator<Record<string, unknown>> {
    if (!conn.send) {
        for (const row of (await conn.query(sql)).toArray()) yield row.toJSON() as Record<string, unknown>
        return
    }
    for await (const batch of await conn.send(sql)) {
        for (const row of batch.toArray()) yield row.toJSON() as Record<string, unknown>
    }
}

const GEOM_CANDIDATES = ['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape']

/**
 * Row count above which the caller is asked before the file is materialized.
 * Rendering scales past this (polygons and lines are tiled client-side), but
 * the whole collection still has to fit in memory, so a genuinely huge file is
 * worth a confirmation rather than a locked-up tab.
 */
export const LARGE_PARQUET_FEATURE_COUNT = 100000

/**
 * Ceiling for the buffered-read fallback. DuckDB's WASM heap is 32-bit and in
 * practice cannot hand out large contiguous blocks, so copying a big file into
 * it fails as an opaque "malloc of size N failed" partway through the load.
 */
export const MAX_BUFFERED_UPLOAD_BYTES = 256 * 1024 * 1024

/** Details handed to {@link LoadParquetOptions.onLargeDataset}. */
export interface LargeParquetDataset {
    /** File or layer name to show the user. */
    name: string
    /** Row count DuckDB reported for the source. */
    featureCount: number
}

export interface LoadParquetOptions {
    /**
     * Invoked when the source has at least {@link LARGE_PARQUET_FEATURE_COUNT}
     * rows, before the expensive materialization. Resolve `false` to abort, which
     * throws {@link ParquetLoadCancelledError}. When omitted, large files load
     * without prompting — that keeps the reload/hydration paths non-interactive,
     * and keeps the load single-pass, since the extra `COUNT(*)` only runs when a
     * guard is attached.
     */
    onLargeDataset?: (dataset: LargeParquetDataset) => boolean | Promise<boolean>
    /** Name shown in the prompt. Defaults to the file name or URL. */
    name?: string
}

/** Thrown by {@link loadParquetForDeck} when the caller declines a large file. */
export class ParquetLoadCancelledError extends Error {
    constructor(message = 'Layer load cancelled.') {
        super(message)
        this.name = 'ParquetLoadCancelledError'
    }
}

/**
 * Count the rows the source would return. DuckDB answers this from Parquet
 * metadata without scanning, so it is a cheap up-front guard.
 */
async function countFeatures(conn: DuckDbConnection, tableSource: string): Promise<number> {
    const res = await conn.query(`SELECT count(*) AS n FROM ${tableSource}`)
    const raw = (res.toArray()[0]?.toJSON() as { n?: unknown } | undefined)?.n
    return typeof raw === 'bigint' ? Number(raw) : Number(raw ?? 0)
}

export interface ParquetDeckData {
    kind: 'points' | 'geojson'
    points?: {
        positions: Float32Array
        count: number
    }
    geojson?: FeatureCollection
    /**
     * Name of the DuckDB table holding this layer's point rows (id, x, y, and
     * every attribute). Attributes stay in DuckDB rather than being pulled into
     * JS, and are read back one row at a time on click — see
     * {@link queryParquetRowProperties}. Dropped with the layer.
     */
    attrTable?: string
    bounds?: [number, number, number, number]
    /** Rows in the source, as reported by `COUNT(*)`. Only set when the guard ran. */
    featureCount?: number
}

/** Columns the point table adds on top of the source's own. */
const ROW_ID = '__rid__'
const POINT_X = '__x__'
const POINT_Y = '__y__'

let attrTableSeq = 0

/**
 * Materialize a point layer into a DuckDB table: a dense row id, the projected
 * coordinates, and every source attribute.
 *
 * The id is what makes click-to-row lookup correct. `row_number()` is evaluated
 * after `WHERE`, so ids are dense over the surviving rows, and reading the
 * coordinates back `ORDER BY` that id makes the position array's index and the
 * row id the same number.
 *
 * Keeping the attributes here rather than in a JS array is the point: a million
 * rows of columnar DuckDB data costs a fraction of a million JS objects, and the
 * popup only ever needs the row that was clicked.
 */
async function materializePoints(
    conn: DuckDbConnection,
    tableSource: string,
    opts: { xExpr: string; yExpr: string; where: string; excludeCol?: string; featureCount?: number; label: string },
): Promise<ParquetDeckData> {
    const table = `pq_pts_${(attrTableSeq++).toString(36)}_${Date.now().toString(36)}`
    const attrs = opts.excludeCol ? `* EXCLUDE (${quoteIdent(opts.excludeCol)})` : '*'
    await conn.query(`
        CREATE OR REPLACE TABLE ${quoteIdent(table)} AS
        SELECT
            row_number() OVER () - 1 AS ${quoteIdent(ROW_ID)},
            ${opts.xExpr}::FLOAT AS ${quoteIdent(POINT_X)},
            ${opts.yExpr}::FLOAT AS ${quoteIdent(POINT_Y)},
            ${attrs}
        FROM ${tableSource}
        WHERE ${opts.where}
    `)

    // Size the buffer from the table's own count, then fill it batch by batch.
    // Reading the coordinates as one Arrow result would hold a full copy in the
    // WASM heap and another in JS at the same time; the destination array is the
    // only full-size allocation this way, and it is the one Deck keeps anyway.
    const countRow = (await conn.query(`SELECT count(*) AS n FROM ${quoteIdent(table)}`))
        .toArray()[0]?.toJSON() as { n?: unknown } | undefined
    const count = typeof countRow?.n === 'bigint' ? Number(countRow.n) : Number(countRow?.n ?? 0)

    const positions = new Float32Array(count * 2)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let i = 0
    const coordSql =
        `SELECT ${quoteIdent(POINT_X)} AS x, ${quoteIdent(POINT_Y)} AS y
         FROM ${quoteIdent(table)} ORDER BY ${quoteIdent(ROW_ID)}`
    for await (const row of streamRows(conn, coordSql)) {
        if (i >= count) break
        const px = Number(row.x)
        const py = Number(row.y)
        positions[i * 2] = px
        positions[i * 2 + 1] = py
        if (px < minX) minX = px
        if (py < minY) minY = py
        if (px > maxX) maxX = px
        if (py > maxY) maxY = py
        i++
    }

    const bounds: [number, number, number, number] | undefined =
        minX !== Infinity ? [minX, minY, maxX, maxY] : undefined
    // A projected file that declared no CRS gets caught here rather than
    // rendering nowhere. Drop the table first — the layer is not going to load.
    try {
        assertGeographicBounds(bounds, opts.label)
    } catch (e) {
        await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`).catch(() => {})
        throw e
    }

    return {
        kind: 'points',
        points: { positions, count },
        bounds,
        featureCount: opts.featureCount,
        attrTable: table,
    }
}

/**
 * Read the attributes of specific point rows by id. Called on click with the
 * handful of rows actually picked, so cost is independent of the layer's size.
 */
export async function queryParquetRowProperties(
    attrTable: string,
    rowIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
    const out = new Map<number, Record<string, unknown>>()
    if (rowIds.length === 0) return out
    // Ids come from Deck's picking index, never from user input; coerced to
    // integers anyway so the list can be inlined.
    const idList = rowIds.map(n => Math.trunc(Number(n))).filter(Number.isFinite).join(',')
    if (!idList) return out

    return withConnection(async (conn) => {
        const res = await conn.query(
            `SELECT * EXCLUDE (${quoteIdent(POINT_X)}, ${quoteIdent(POINT_Y)})
             FROM ${quoteIdent(attrTable)} WHERE ${quoteIdent(ROW_ID)} IN (${idList})`,
        )
        for (const row of res.toArray()) {
            const obj = row.toJSON() as Record<string, unknown>
            const rid = Number(obj[ROW_ID])
            delete obj[ROW_ID]
            out.set(rid, normalizeRow(obj) as Record<string, unknown>)
        }
        return out
    })
}

/**
 * Rough extent from the first coordinate of a sample of features — enough to
 * tell lon/lat from projected metres, without walking every ring of every
 * polygon. Used only for the geographic-range backstop.
 */
function sampleBounds(features: Feature[]): [number, number, number, number] | undefined {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const f of features.slice(0, 100)) {
        let c: unknown = (f.geometry as { coordinates?: unknown } | null)?.coordinates
        while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
        if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue
        const [x, y] = c as [number, number]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    }
    return minX !== Infinity ? [minX, minY, maxX, maxY] : undefined
}

/** Drop a layer's point table. Called when the layer is removed. */
export async function dropParquetAttributeTable(attrTable: string): Promise<void> {
    try {
        await withConnection(conn => conn.query(`DROP TABLE IF EXISTS ${quoteIdent(attrTable)}`))
    } catch (e) {
        console.warn(`[user-layers] could not drop attribute table ${attrTable}:`, e)
    }
}

export async function loadParquetForDeck(source: string | File, opts: LoadParquetOptions = {}): Promise<ParquetDeckData> {
    return withConnection(async (conn, db) => {
        // Resolve the source BEFORE loading spatial. `LOAD spatial` on a
        // connection that has not yet read a Parquet file poisons `read_parquet`
        // on that connection ("stoi: no conversion"), so the file is registered
        // first and handed to `loadSpatial` as its warm-up read.
        let tableSource: string
        let virtualName: string | null = null
        // `parquet_kv_metadata` takes the file itself, not a `read_parquet(...)`
        // expression, so the bare name is kept alongside the scan source.
        let crsFileName: string
        const label = opts.name ?? (typeof source === 'string' ? source : source.name)

        if (typeof source === 'string') {
            tableSource = `read_parquet('${escapeSql(source)}')`
            crsFileName = source
        } else {
            virtualName = `user-upload-${crypto.randomUUID()}.parquet`
            const duckdb = await import('@duckdb/duckdb-wasm')
            try {
                // Streams byte ranges straight off the File — DuckDB reads only
                // the row groups it needs and nothing is copied into the heap.
                await db.registerFileHandle(virtualName, source, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true)
            } catch (e) {
                // The fallback copies the ENTIRE file into DuckDB's WASM heap,
                // which is 32-bit and cannot serve large contiguous blocks — a
                // big file dies here as "malloc of size N failed". Better to say
                // what actually went wrong than to attempt it and blow up.
                console.warn('[user-layers] PMTiles-style streaming read unavailable, buffering instead:', e)
                if (source.size > MAX_BUFFERED_UPLOAD_BYTES) {
                    throw new Error(
                        `"${source.name}" (${Math.round(source.size / 1024 ** 2)} MB) cannot be streamed in this ` +
                        `browser, and is too large to load into memory whole. Add it by URL instead — remote ` +
                        `Parquet is read a row group at a time.`,
                    )
                }
                const buffer = new Uint8Array(await source.arrayBuffer())
                await db.registerFileBuffer(virtualName, buffer)
            }
            tableSource = `read_parquet('${virtualName}')`
            crsFileName = virtualName
        }

        await loadSpatial(conn, () => conn.query(`SELECT 1 FROM ${tableSource} LIMIT 0`))
        // Read geometry as raw WKB rather than letting DuckDB decode GeoParquet
        // natively. Unknown on builds without the setting, so failure is fine.
        try {
            await conn.query('SET enable_geoparquet_conversion = false')
        } catch {
            /* older/newer builds may not expose it */
        }

        try {
            // Cheap row count first: Parquet answers it from metadata, so a file
            // too big to be worth loading is rejected before anything is read.
            let featureCount: number | undefined
            if (opts.onLargeDataset) {
                featureCount = await countFeatures(conn, tableSource)
                if (featureCount >= LARGE_PARQUET_FEATURE_COUNT) {
                    const name = opts.name ?? (typeof source === 'string' ? source : source.name)
                    const proceed = await opts.onLargeDataset({ name, featureCount })
                    if (!proceed) throw new ParquetLoadCancelledError()
                }
            }

            const described = await conn.query(`DESCRIBE SELECT * FROM ${tableSource}`)
            const columns = described.toArray().map(r => String((r.toJSON() as Record<string, unknown>).column_name))

            const lonCol = columns.find(c => ['lon', 'longitude', 'x', 'lng'].includes(c.toLowerCase()))
            const latCol = columns.find(c => ['lat', 'latitude', 'y'].includes(c.toLowerCase()))

            const geomCol =
                GEOM_CANDIDATES.find(c => columns.includes(c)) ||
                columns.find(c => {
                    const row = described.toArray().find(r => String((r.toJSON() as Record<string, unknown>).column_name) === c)
                    const colType = String((row?.toJSON() as Record<string, unknown>)?.column_type || '').toUpperCase()
                    return colType.includes('GEOMETRY') || colType.includes('BLOB') || colType.includes('BYTEA')
                })

            // A lon/lat column pair and WKB point geometry differ only in how x
            // and y are derived, so both go through the same materialization.
            // Plain coordinate columns carry no CRS metadata, so they are taken
            // as lon/lat and checked against the geographic range afterwards.
            if (lonCol && latCol && !geomCol) {
                return materializePoints(conn, tableSource, {
                    xExpr: quoteIdent(lonCol),
                    yExpr: quoteIdent(latCol),
                    where: `${quoteIdent(lonCol)} IS NOT NULL AND ${quoteIdent(latCol)} IS NOT NULL`,
                    featureCount,
                    label,
                })
            }

            if (!geomCol) {
                throw new Error('Parquet file contains no recognized geometry or coordinates column.')
            }

            // Inspect geometry type
            let isPoint = false
            try {
                const typeRes = await conn.query(`
                    SELECT ST_GeometryType(ST_GeomFromWKB(${quoteIdent(geomCol)})) AS gtype
                    FROM ${tableSource}
                    WHERE ${quoteIdent(geomCol)} IS NOT NULL
                    LIMIT 1
                `)
                const typeRow = typeRes.toArray()[0]?.toJSON() as { gtype?: string } | undefined
                const gtype = String(typeRow?.gtype || '').toUpperCase()
                isPoint = gtype === 'POINT' || gtype === 'MULTIPOINT'
            } catch {
                isPoint = false
            }

            // DuckDB does not surface a GeoParquet file's CRS in the scan, so it
            // is read from the file's `geo` metadata and folded into the geometry
            // expression. Without this a projected file renders nowhere.
            const sourceCrs = await readGeoParquetCrs(conn, crsFileName, geomCol)
            const geomExpr = reprojectToWgs84(`ST_GeomFromWKB(${quoteIdent(geomCol)})`, sourceCrs)

            // Points -> binary coordinates on the GPU
            if (isPoint) {
                return materializePoints(conn, tableSource, {
                    xExpr: `ST_X(${geomExpr})`,
                    yExpr: `ST_Y(${geomExpr})`,
                    where: `${quoteIdent(geomCol)} IS NOT NULL`,
                    excludeCol: geomCol,
                    featureCount,
                    label,
                })
            }

            // Polygons / Lines -> GeoJSON
            const query = `
                SELECT
                    ST_AsGeoJSON(${geomExpr}) AS __geom__,
                    * EXCLUDE (${quoteIdent(geomCol)})
                FROM ${tableSource}
            `
            const features: Feature[] = []
            for await (const obj of streamRows(conn, query)) {
                const geomStr = obj.__geom__ ? String(obj.__geom__) : null
                delete obj.__geom__

                if (geomStr) {
                    try {
                        const geometry = JSON.parse(geomStr)
                        features.push({
                            type: 'Feature',
                            geometry,
                            properties: normalizeRow(obj),
                        })
                    } catch {
                        // Skip malformed geometry
                    }
                }
            }

            assertGeographicBounds(sampleBounds(features), label)

            return {
                kind: 'geojson',
                geojson: {
                    type: 'FeatureCollection',
                    features,
                },
                featureCount,
            }
        } finally {
            if (virtualName) {
                try {
                    await db.dropFile(virtualName)
                } catch {
                    // Ignore drop error
                }
            }
        }
    })
}
