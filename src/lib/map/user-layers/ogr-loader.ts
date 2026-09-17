/**
 * GDAL-backed vector files (GeoPackage, Shapefile, FlatGeobuf) read straight
 * into DuckDB with `ST_Read`, so they land in the same point/attribute tables
 * the GeoParquet path uses and inherit viewport slicing and click lookups.
 *
 * `.gdb` goes the long way: DuckDB's build exposes no OpenFileGDB driver, so
 * gdal3.js converts it to FlatGeobuf first — still never building GeoJSON for
 * the point path.
 */
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import { withConnection, loadSpatial, quoteIdent, escapeSql, streamRows, resultRows, normalizeRow } from '@/lib/duckdb/client'
import { isRecord } from '@/lib/utils'
import { reprojectToWgs84, assertGeographicBounds } from '@/lib/map/user-layers/geoparquet-crs'
import type { ParquetDeckData } from '@/lib/map/user-layers/parquet-deck-loader'

const ROW_ID = '__rid__'
const POINT_X = '__x__'
const POINT_Y = '__y__'

const GEOMETRY_TYPES = new Set([
    'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection',
])

/** Checked narrowing for the geometry `ST_AsGeoJSON` hands back. */
function isGeometry(value: unknown): value is Geometry {
    if (!isRecord(value) || typeof value.type !== 'string' || !GEOMETRY_TYPES.has(value.type)) return false
    return value.type === 'GeometryCollection' ? Array.isArray(value.geometries) : Array.isArray(value.coordinates)
}

/** What DuckDB's own GDAL build can open. `.gdb` is converted first. */
const DUCKDB_EXTENSIONS = ['.gpkg', '.fgb', '.shp.zip']
const GDAL_ONLY_EXTENSIONS = ['.gdb.zip']

export function isOgrFileName(name: string): boolean {
    const lower = name.toLowerCase()
    return [...DUCKDB_EXTENSIONS, ...GDAL_ONLY_EXTENSIONS].some(ext => lower.endsWith(ext))
}

/** Strip the extension for a layer title. */
export function ogrTitle(name: string): string {
    return name.replace(/\.(gpkg|fgb|shp\.zip|gdb\.zip)$/i, '')
}

let seq = 0

/** A layer's SRS, as `ST_Read_Meta` reports it. Null when the file declares none. */
async function readSourceCrs(conn: Parameters<typeof loadSpatial>[0], virtualName: string): Promise<string | null> {
    try {
        const res = await conn.query(
            `SELECT layers[1].geometry_fields[1].crs.auth_name AS auth,
                    layers[1].geometry_fields[1].crs.auth_code AS code
             FROM ST_Read_Meta('${escapeSql(virtualName)}')`,
        )
        for (const row of resultRows(res)) {
            const auth = typeof row.auth === 'string' ? row.auth : null
            const code = row.code === null || row.code === undefined ? null : String(row.code)
            if (auth && code) return `${auth}:${code}`
        }
    } catch {
        // Older builds expose a different meta shape; treat as undeclared.
    }
    return null
}

/** gdal3.js converts a format DuckDB cannot open into one it can. */
async function toFlatGeobuf(file: File): Promise<File> {
    const { convertToFlatGeobuf } = await import('@/lib/gdal-export')
    const bytes = await convertToFlatGeobuf(file)
    return new File([new Uint8Array(bytes)], `${ogrTitle(file.name)}.fgb`)
}

export async function loadOgrForDeck(file: File, opts: { name?: string } = {}): Promise<ParquetDeckData> {
    const label = opts.name ?? file.name
    const readable = GDAL_ONLY_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
        ? await toFlatGeobuf(file)
        : file

    return withConnection(async (conn, db) => {
        const virtualName = `user-ogr-${crypto.randomUUID()}-${readable.name}`
        await db.registerFileBuffer(virtualName, new Uint8Array(await readable.arrayBuffer()))
        await loadSpatial(conn)

        const base = `ogr_${(seq++).toString(36)}_${Date.now().toString(36)}`
        const all = `${base}_all`
        const pointTable = `${base}_pts`
        const attrTable = `${base}_attrs`
        const source = `ST_Read('${escapeSql(virtualName)}')`
        // ST_Read hands back the file's own coordinates, so a State Plane layer
        // needs reprojecting before anything compares it to lon/lat.
        const geom = reprojectToWgs84('geom', await readSourceCrs(conn, virtualName))

        try {
            const typeRes = await conn.query(
                `SELECT ST_GeometryType(geom) AS t FROM ${source} WHERE geom IS NOT NULL LIMIT 1`,
            )
            const first = [...resultRows(typeRes)][0]
            const kind = String(first?.t ?? '').toUpperCase()
            const isPoint = kind === 'POINT' || kind === 'MULTIPOINT'

            if (!isPoint) {
                return await readAsGeoJson(conn, source, geom, label)
            }

            // One scan: two would not be guaranteed to number the rows alike.
            await conn.query(`
                CREATE OR REPLACE TABLE ${quoteIdent(all)} AS
                SELECT row_number() OVER () - 1 AS ${quoteIdent(ROW_ID)},
                       ST_X(${geom})::FLOAT AS ${quoteIdent(POINT_X)},
                       ST_Y(${geom})::FLOAT AS ${quoteIdent(POINT_Y)},
                       * EXCLUDE (geom)
                FROM ${source} WHERE geom IS NOT NULL
            `)
            await conn.query(`CREATE OR REPLACE TABLE ${quoteIdent(pointTable)} AS
                SELECT ${quoteIdent(ROW_ID)}, ${quoteIdent(POINT_X)}, ${quoteIdent(POINT_Y)} FROM ${quoteIdent(all)}`)
            await conn.query(`CREATE OR REPLACE TABLE ${quoteIdent(attrTable)} AS
                SELECT * EXCLUDE (${quoteIdent(POINT_X)}, ${quoteIdent(POINT_Y)}) FROM ${quoteIdent(all)}`)

            const statsRes = await conn.query(`
                SELECT count(*) AS n, min(${quoteIdent(POINT_X)}) AS minx, min(${quoteIdent(POINT_Y)}) AS miny,
                       max(${quoteIdent(POINT_X)}) AS maxx, max(${quoteIdent(POINT_Y)}) AS maxy
                FROM ${quoteIdent(pointTable)}`)
            const stats = [...resultRows(statsRes)][0] ?? {}
            const num = (v: unknown) => (typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : undefined)
            const minx = num(stats.minx), miny = num(stats.miny)
            const maxx = num(stats.maxx), maxy = num(stats.maxy)
            const extent: [number, number, number, number] | undefined =
                minx !== undefined && miny !== undefined && maxx !== undefined && maxy !== undefined
                    ? [minx, miny, maxx, maxy]
                    : undefined
            // A projected file that declared no CRS lands nowhere; say so instead.
            assertGeographicBounds(extent, label)

            return {
                kind: 'points',
                points: { count: num(stats.n) ?? 0 },
                bounds: extent,
                pointTable,
                attrTable,
            }
        } finally {
            await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(all)}`).catch(() => { })
            await db.dropFile(virtualName).catch(() => { })
        }
    })
}

/** Polygons and lines go to the tiled GeoJSON path, as Parquet's do. */
async function readAsGeoJson(
    conn: Parameters<typeof loadSpatial>[0],
    source: string,
    geom: string,
    label: string,
): Promise<ParquetDeckData> {
    const features: Feature[] = []
    const sql = `SELECT ST_AsGeoJSON(${geom}) AS __geom__, * EXCLUDE (geom) FROM ${source} WHERE geom IS NOT NULL`
    for await (const row of streamRows(conn, sql)) {
        const geomText = row.__geom__
        if (typeof geomText !== 'string') continue
        delete row.__geom__
        try {
            const parsed: unknown = JSON.parse(geomText)
            if (!isGeometry(parsed)) continue
            features.push({ type: 'Feature', geometry: parsed, properties: normalizeRow(row) })
        } catch {
            // Skip malformed geometry.
        }
    }
    if (features.length === 0) throw new Error(`"${label}" has no readable geometry.`)
    const geojson: FeatureCollection = { type: 'FeatureCollection', features }
    return { kind: 'geojson', geojson }
}
