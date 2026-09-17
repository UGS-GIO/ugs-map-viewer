/**
 * Reading a GeoParquet file's declared CRS.
 *
 * DuckDB's `read_parquet` does not surface a file's CRS anywhere in the scan, so
 * a file stored in a projected CRS loads with raw coordinates — eastings and
 * northings in metres — and draws nothing, or lands somewhere absurd. Nothing
 * errors; the layer just isn't where it should be.
 *
 * The CRS isn't lost, though. The GeoParquet specification writes it into the
 * Parquet file-level key/value metadata under the key `geo`, which DuckDB does
 * expose through `parquet_kv_metadata`. This module reads that document and
 * resolves it to an identifier `ST_Transform` accepts, so the loader can
 * reproject to WGS84.
 *
 * Mirrors GeoLibre's `geoparquet-crs.ts`, which solves the same problem after
 * hitting it with an EPSG:2100 file.
 */
import { escapeSql } from '@/lib/duckdb/client'

/** The Parquet file-metadata key the GeoParquet specification writes to. */
const GEOPARQUET_METADATA_KEY = 'geo'

/** What WGS84 lon/lat is called in the two spellings a `geo` block may use. */
const WGS84_IDENTIFIERS = new Set(['EPSG:4326', 'OGC:CRS84', 'CRS84'])

/** The CRS all user layers are reprojected to — what MapLibre expects. */
export const TARGET_CRS = 'EPSG:4326'

/** A minimal connection shape, so this module needn't import duckdb. */
type DuckDbConnection = {
    query: (sql: string) => Promise<{ toArray: () => Array<{ toJSON: () => unknown }> }>
}

/**
 * SQL yielding the `geo` metadata document as text, or no rows when the file
 * carries none (a plain, non-spatial Parquet).
 *
 * The key is matched as a BLOB via `encode` rather than by decoding every key,
 * so a file carrying a non-UTF-8 metadata key can't fail the whole read.
 */
export function geoParquetMetadataSql(fileName: string): string {
    return (
        `SELECT decode(value) AS geo_metadata ` +
        `FROM parquet_kv_metadata('${escapeSql(fileName)}') ` +
        `WHERE key = encode('${escapeSql(GEOPARQUET_METADATA_KEY)}')`
    )
}

interface GeoParquetColumn {
    crs?: unknown
    encoding?: string
}

interface GeoParquetMetadata {
    primary_column?: string
    columns?: Record<string, GeoParquetColumn>
}

/**
 * Resolve a `geo` block's `crs` value to something `ST_Transform` accepts.
 *
 * The spec allows three shapes, plus a meaningful absence:
 *  - omitted or `null` — explicitly defined to mean OGC:CRS84 (lon/lat WGS84),
 *    so there is nothing to transform.
 *  - a PROJJSON object — the usual case. An embedded `id` gives an authority
 *    code, which PROJ resolves far more reliably than the full document; the
 *    document itself is the fallback, and PROJ accepts PROJJSON text directly.
 *  - a bare string, written by some older writers — passed through as-is.
 */
export function resolveCrsIdentifier(crs: unknown): string | null {
    if (crs == null) return null
    if (typeof crs === 'string') {
        const trimmed = crs.trim()
        return trimmed && !WGS84_IDENTIFIERS.has(trimmed.toUpperCase()) ? trimmed : null
    }
    if (typeof crs !== 'object') return null

    const id = (crs as { id?: { authority?: unknown; code?: unknown } }).id
    if (id && typeof id.authority === 'string' && (typeof id.code === 'string' || typeof id.code === 'number')) {
        const identifier = `${id.authority.toUpperCase()}:${id.code}`
        return WGS84_IDENTIFIERS.has(identifier) ? null : identifier
    }
    // No identifier embedded — hand PROJ the whole document.
    return JSON.stringify(crs)
}

/**
 * Read a Parquet file's declared CRS, or null when it has none, is already
 * WGS84, or the metadata can't be read.
 *
 * Never throws: a file with no `geo` block is an ordinary Parquet with plain
 * coordinate columns, which is a supported case, not an error.
 *
 * @param fileName The URL or registered DuckDB file name — NOT a `read_parquet(...)` expression.
 * @param geometryColumn The geometry column the loader settled on, when known.
 */
export async function readGeoParquetCrs(
    conn: DuckDbConnection,
    fileName: string,
    geometryColumn?: string,
): Promise<string | null> {
    let raw: string | undefined
    try {
        const res = await conn.query(geoParquetMetadataSql(fileName))
        const row = res.toArray()[0]?.toJSON() as { geo_metadata?: unknown } | undefined
        if (typeof row?.geo_metadata === 'string') raw = row.geo_metadata
    } catch (e) {
        console.warn('[user-layers] could not read GeoParquet `geo` metadata:', e)
        return null
    }
    if (!raw) return null

    let meta: GeoParquetMetadata
    try {
        meta = JSON.parse(raw) as GeoParquetMetadata
    } catch {
        console.warn('[user-layers] GeoParquet `geo` metadata is not valid JSON; assuming WGS84')
        return null
    }

    const columns = meta.columns ?? {}
    const column =
        (geometryColumn ? columns[geometryColumn] : undefined) ??
        (meta.primary_column ? columns[meta.primary_column] : undefined) ??
        Object.values(columns)[0]
    return resolveCrsIdentifier(column?.crs)
}

/**
 * Wrap a geometry expression in a reprojection to WGS84 when the source is in
 * something else.
 *
 * `always_xy` normalises axis order to lon/lat, which matters even when the
 * source is already EPSG:4326 — the authority definition of 4326 is lat/lon, and
 * some writers store it that way.
 */
export function reprojectToWgs84(geometryExpression: string, sourceCrs: string | null): string {
    if (!sourceCrs) return geometryExpression
    return `ST_Transform(${geometryExpression}, '${escapeSql(sourceCrs)}', '${TARGET_CRS}', true)`
}

/**
 * Reject coordinates that cannot be WGS84 lon/lat.
 *
 * This is the backstop for a file whose CRS could not be resolved — a missing
 * `geo` block on a projected file, or plain x/y columns holding eastings and
 * northings. Without it the layer loads "successfully" and silently draws
 * nowhere, which is the hardest kind of failure to diagnose. Turning it into a
 * message naming the CRS problem is worth more than rendering nothing.
 */
export function assertGeographicBounds(
    bounds: [number, number, number, number] | undefined,
    label: string,
): void {
    if (!bounds) return
    const [minX, minY, maxX, maxY] = bounds
    const maxAbsX = Math.max(Math.abs(minX), Math.abs(maxX))
    const maxAbsY = Math.max(Math.abs(minY), Math.abs(maxY))
    if (maxAbsX <= 180 && maxAbsY <= 90) return

    throw new Error(
        `"${label}" has coordinates outside the range of longitude/latitude ` +
        `(x up to ${Math.round(maxAbsX).toLocaleString()}, y up to ${Math.round(maxAbsY).toLocaleString()}), ` +
        `so it is in a projected coordinate system the file does not declare. ` +
        `Reproject it to EPSG:4326 before adding it, or rewrite it with GeoParquet CRS metadata.`,
    )
}
