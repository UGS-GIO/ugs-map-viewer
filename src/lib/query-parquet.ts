import type { Feature, Geometry } from 'geojson'
import { withConnection, loadSpatial, escapeSql } from '@/lib/duckdb'

/**
 * Fetch a set of features from a remote parquet by their ogc_fid values via
 * DuckDB-WASM. Geometry is decoded from the parquet's `geometry` column when
 * present (assumes GeoParquet WKB encoding). Properties are every non-geometry
 * column.
 *
 * Single round trip per parquet — DuckDB fetches just the row groups it needs
 * via HTTP range reads, so the by-id lookup is cheap even on multi-GB tables.
 */
export async function fetchFeaturesByOgcFidsFromParquet(
    parquetUrl: string,
    ogcFids: ReadonlyArray<string | number>,
    opts: { idColumn?: string; geometryColumn?: string } = {},
): Promise<Feature[]> {
    if (ogcFids.length === 0) return []

    const { idColumn = 'ogc_fid', geometryColumn = 'geometry' } = opts
    const ids = ogcFids
        .map(id => Number(id))
        .filter(n => Number.isFinite(n))
    if (ids.length === 0) return []

    return withConnection(async (conn) => {
        await loadSpatial(conn)

        const escapedUrl = escapeSql(parquetUrl)
        const idList = ids.join(',')
        // Probe the schema once so we only project columns that exist — keeps
        // the query robust against per-layer schema drift.
        const schemaResult = await conn.query(
            `SELECT column_name FROM (DESCRIBE SELECT * FROM read_parquet('${escapedUrl}'))`,
        )
        const columns = schemaResult.toArray().map((row: { column_name: string }) => row.column_name)
        const hasGeometry = columns.includes(geometryColumn)
        const hasId = columns.includes(idColumn)
        if (!hasId) {
            console.warn(`[summary] parquet ${parquetUrl} has no ${idColumn} column — skipping`)
            return []
        }

        const geomProjection = hasGeometry
            ? `, ST_AsGeoJSON(${geometryColumn}) AS __geometry_geojson`
            : ''
        const skipCols = new Set<string>([geometryColumn])
        const propCols = columns.filter(c => !skipCols.has(c))
        const propProjection = propCols.map(c => `"${c}"`).join(', ')

        const query = `
            SELECT ${propProjection}${geomProjection}
            FROM read_parquet('${escapedUrl}')
            WHERE ${idColumn} IN (${idList})
        `
        const result = await conn.query(query)
        const rows = result.toArray() as Array<Record<string, unknown>>

        return rows.map((row): Feature<Geometry, Record<string, unknown>> => {
            let geometry: Geometry = { type: 'Point', coordinates: [0, 0] }
            const geoJsonStr = row['__geometry_geojson']
            if (typeof geoJsonStr === 'string') {
                try {
                    geometry = JSON.parse(geoJsonStr) as Geometry
                } catch {
                    // fall through to default
                }
            }
            const props: Record<string, unknown> = {}
            for (const c of propCols) props[c] = row[c]
            return {
                type: 'Feature',
                id: row[idColumn] as string | number,
                geometry,
                properties: props,
            }
        })
    })
}
