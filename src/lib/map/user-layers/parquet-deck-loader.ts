import type { FeatureCollection, Feature } from 'geojson'
import { withConnection, loadSpatial, escapeSql, quoteIdent, normalizeRow, streamRows, resultRows } from '@/lib/duckdb/client'
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

const GEOM_CANDIDATES = ['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape']

/** Narrow a row's `toJSON()` to a field bag. Checked, not asserted: DuckDB
 *  types it as `unknown` and the shape depends on the query. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** First row of a result as a field bag, or undefined when empty. */
function firstRow(result: DuckDbResult): Record<string, unknown> | undefined {
    const row = result.toArray()[0]
    if (!row) return undefined
    const json = row.toJSON()
    return isRecord(json) ? json : undefined
}

/** A numeric cell. DuckDB hands back `bigint` for counts and `number` for
 *  floats; anything else is not a number this code can use. */
function cellToNumber(value: unknown): number | undefined {
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
    return undefined
}

/**
 * Row count above which the caller is asked before the file is materialized.
 * Rendering scales past this (polygons and lines are tiled client-side), but
 * the whole collection still has to fit in memory, so a genuinely huge file is
 * worth a confirmation rather than a locked-up tab.
 */
export const LARGE_PARQUET_FEATURE_COUNT = 100000

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
    return cellToNumber(firstRow(res)?.n) ?? 0
}

export interface ParquetDeckData {
    kind: 'points' | 'geojson'
    points?: {
        /** Rows in the point table. What is drawn is a viewport slice of it. */
        count: number
    }
    geojson?: FeatureCollection
    /** DuckDB table of row id + coordinates. Read per viewport; see
     *  {@link queryPointsInViewport}. Dropped with the layer. */
    pointTable?: string
    /**
     * DuckDB table of row id + every source attribute, built in the background
     * after the map has drawn. Attributes stay in DuckDB rather than being
     * pulled into JS, and are read back a row at a time on click — see
     * {@link queryParquetRowProperties}. Dropped with the layer.
     */
    attrTable?: string
    bounds?: [number, number, number, number]
    /** Rows in the source, as reported by `COUNT(*)`. Only set when the guard ran. */
    featureCount?: number
}

/** The parquet's own physical row number, exposed by `file_row_number=true`.
 *  Stable across scans, unlike `row_number()` over a parallel one. */
const FILE_ROW_NUMBER = 'file_row_number'

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
    const base = `pq_${(attrTableSeq++).toString(36)}_${Date.now().toString(36)}`
    const pointTable = `${base}_pts`
    const attrTable = `${base}_attrs`

    // Coordinates only. Copying the attributes here as well is what used to make
    // this the slowest step of a load — 4.8s against 257ms on a 1.1M-row Overture
    // file, whose nested `names`/`categories`/`sources` columns nothing draws.
    await conn.query(`
        CREATE OR REPLACE TABLE ${quoteIdent(pointTable)} AS
        SELECT
            ${FILE_ROW_NUMBER} AS ${quoteIdent(ROW_ID)},
            ${opts.xExpr}::FLOAT AS ${quoteIdent(POINT_X)},
            ${opts.yExpr}::FLOAT AS ${quoteIdent(POINT_Y)}
        FROM ${tableSource}
        WHERE ${opts.where}
    `)

    // Count and extent come from one aggregate. Nothing walks the rows in JS:
    // the coordinates that reach the GPU are a viewport slice, read later by
    // {@link queryPointsInViewport}.
    const stats = firstRow(await conn.query(`
        SELECT count(*) AS n,
               min(${quoteIdent(POINT_X)}) AS minx, min(${quoteIdent(POINT_Y)}) AS miny,
               max(${quoteIdent(POINT_X)}) AS maxx, max(${quoteIdent(POINT_Y)}) AS maxy
        FROM ${quoteIdent(pointTable)}
    `))
    const count = cellToNumber(stats?.n) ?? 0
    const minx = cellToNumber(stats?.minx)
    const miny = cellToNumber(stats?.miny)
    const maxx = cellToNumber(stats?.maxx)
    const maxy = cellToNumber(stats?.maxy)
    const bounds: [number, number, number, number] | undefined =
        minx !== undefined && miny !== undefined && maxx !== undefined && maxy !== undefined
            ? [minx, miny, maxx, maxy]
            : undefined

    // A projected file that declared no CRS gets caught here rather than
    // rendering nowhere. Drop the table first — the layer is not going to load.
    try {
        assertGeographicBounds(bounds, opts.label)
    } catch (e) {
        await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(pointTable)}`).catch(() => {})
        throw e
    }

    startAttributeBuild(attrTable, tableSource, opts)

    return {
        kind: 'points',
        points: { count },
        bounds,
        featureCount: opts.featureCount,
        pointTable,
        attrTable,
    }
}

/** Attribute tables still being built, by table name. */
const attributeBuilds = new Map<string, Promise<void>>()

/**
 * Build the attribute table off the critical path.
 *
 * Nothing needs the attributes until something is clicked, and the same scan
 * that copies them takes twenty times longer than the coordinates, so the map
 * draws first and this catches up. Row ids are the parquet's own
 * `file_row_number`, so the two tables line up without depending on two scans
 * producing rows in the same order.
 */
function startAttributeBuild(
    attrTable: string,
    tableSource: string,
    opts: { where: string; excludeCol?: string },
): void {
    const excluded = [opts.excludeCol, FILE_ROW_NUMBER].filter((c): c is string => !!c)
    const attrs = `* EXCLUDE (${excluded.map(quoteIdent).join(', ')})`
    const build = withConnection(conn => conn.query(`
        CREATE OR REPLACE TABLE ${quoteIdent(attrTable)} AS
        SELECT ${FILE_ROW_NUMBER} AS ${quoteIdent(ROW_ID)}, ${attrs}
        FROM ${tableSource}
        WHERE ${opts.where}
    `)).then(() => undefined, (e: unknown) => {
        console.warn(`[user-layers] attribute table ${attrTable} failed to build:`, e)
    })
    attributeBuilds.set(attrTable, build)
}

/**
 * Most points Deck is asked to draw at once.
 *
 * Cost is per instance, not per pixel: at 1.08M instances a pan runs at 8 fps,
 * at 200k at 41 fps, at 100k at 60 fps — with point radius and antialiasing
 * making almost no difference. So the cap, not the styling, is what keeps a pan
 * smooth, and anything past it is thinned out.
 */
export const MAX_DRAWN_POINTS = 120000

/** One viewport's worth of drawable points. */
export interface ParquetPointView {
    /** Interleaved lon/lat, ready to hand Deck as a binary attribute. */
    positions: Float32Array
    /** Point table row id per drawn point, for click lookups. */
    rowIds: Int32Array
    /** Points drawn (`positions.length / 2`). */
    count: number
    /** Points the viewport actually holds, before thinning. */
    inView: number
    /** 1 = every point drawn; n = every nth. */
    stride: number
}

/**
 * Read the points inside `bbox`, thinned to at most {@link MAX_DRAWN_POINTS}.
 *
 * Thinning is `rid % stride`, not a random sample, so the same points survive
 * from one pan to the next and the map doesn't shimmer. Zoomed in, the viewport
 * holds fewer points than the cap and every one of them is drawn.
 */
export async function queryPointsInViewport(
    attrTable: string,
    bbox: [number, number, number, number],
    cap = MAX_DRAWN_POINTS,
): Promise<ParquetPointView> {
    const [minx, miny, maxx, maxy] = bbox.map(n => Number(n))
    const t = quoteIdent(attrTable)
    const where =
        `${quoteIdent(POINT_X)} BETWEEN ${minx} AND ${maxx} AND ` +
        `${quoteIdent(POINT_Y)} BETWEEN ${miny} AND ${maxy}`

    return withConnection(async (conn) => {
        const countRow = firstRow(await conn.query(`SELECT count(*) AS n FROM ${t} WHERE ${where}`))
        const inView = cellToNumber(countRow?.n) ?? 0
        if (inView === 0) {
            return { positions: new Float32Array(0), rowIds: new Int32Array(0), count: 0, inView: 0, stride: 1 }
        }

        const stride = Math.max(1, Math.ceil(inView / cap))
        const strideClause = stride > 1 ? ` AND ${quoteIdent(ROW_ID)} % ${stride} = 0` : ''
        // One extra slot: integer division can leave the last surviving id out.
        const capacity = Math.floor(inView / stride) + 1
        const positions = new Float32Array(capacity * 2)
        const rowIds = new Int32Array(capacity)

        let i = 0
        const sql =
            `SELECT ${quoteIdent(ROW_ID)} AS rid, ${quoteIdent(POINT_X)} AS x, ${quoteIdent(POINT_Y)} AS y
             FROM ${t} WHERE ${where}${strideClause}`
        for await (const row of streamRows(conn, sql)) {
            if (i >= capacity) break
            const x = cellToNumber(row.x)
            const y = cellToNumber(row.y)
            const rid = cellToNumber(row.rid)
            if (x === undefined || y === undefined || rid === undefined) continue
            positions[i * 2] = x
            positions[i * 2 + 1] = y
            rowIds[i] = rid
            i++
        }

        return {
            positions: positions.subarray(0, i * 2),
            rowIds: rowIds.subarray(0, i),
            count: i,
            inView,
            stride,
        }
    })
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

    // The table may still be building — a click can beat it on a large file.
    await attributeBuilds.get(attrTable)

    return withConnection(async (conn) => {
        const res = await conn.query(
            `SELECT * FROM ${quoteIdent(attrTable)} WHERE ${quoteIdent(ROW_ID)} IN (${idList})`,
        )
        for (const obj of resultRows(res)) {
            const rid = cellToNumber(obj[ROW_ID])
            if (rid === undefined) continue
            delete obj[ROW_ID]
            const props = normalizeRow(obj)
            if (isRecord(props)) out.set(rid, props)
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

/** Drop a layer's DuckDB tables. Called when the layer is removed. */
export async function dropParquetTables(data: Pick<ParquetDeckData, 'pointTable' | 'attrTable'>): Promise<void> {
    const tables = [data.pointTable, data.attrTable].filter((t): t is string => !!t)
    if (tables.length === 0) return
    // A build still in flight would otherwise recreate the table after the drop.
    if (data.attrTable) await attributeBuilds.get(data.attrTable)
    try {
        await withConnection(async (conn) => {
            for (const table of tables) await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`)
        })
    } catch (e) {
        console.warn(`[user-layers] could not drop tables ${tables.join(', ')}:`, e)
    }
    if (data.attrTable) attributeBuilds.delete(data.attrTable)
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
            tableSource = `read_parquet('${escapeSql(source)}', file_row_number=true)`
            crsFileName = source
        } else {
            virtualName = `user-upload-${crypto.randomUUID()}.parquet`
            // `registerFileBuffer` rather than a BROWSER_FILEREADER handle: the
            // handle path reports a file size of 0 back to DuckDB, so the first
            // footer read fails with "Prefetch registered for bytes outside
            // file ... file size: 0". The buffer is TRANSFERRED to the worker,
            // not copied, so this costs one copy in the WASM heap rather than
            // two — which is why the upload ceiling is what it is.
            const buffer = new Uint8Array(await source.arrayBuffer())
            await db.registerFileBuffer(virtualName, buffer)
            tableSource = `read_parquet('${virtualName}', file_row_number=true)`
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
            const describedRows = [...resultRows(described)]
            const columns = describedRows.map(r => String(r.column_name))

            const lonCol = columns.find(c => ['lon', 'longitude', 'x', 'lng'].includes(c.toLowerCase()))
            const latCol = columns.find(c => ['lat', 'latitude', 'y'].includes(c.toLowerCase()))

            const geomCol =
                GEOM_CANDIDATES.find(c => columns.includes(c)) ||
                columns.find(c => {
                    const row = describedRows.find(r => String(r.column_name) === c)
                    const colType = String(row?.column_type ?? '').toUpperCase()
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
                const gtype = String(firstRow(typeRes)?.gtype ?? '').toUpperCase()
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
                    * EXCLUDE (${quoteIdent(geomCol)}, ${quoteIdent(FILE_ROW_NUMBER)})
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
