/**
 * Client-side GeoParquet to GeoJSON converter for user-added layers.
 *
 * Uses DuckDB-WASM + spatial extension to read remote URLs or local Files
 * and decode WKB / GeoParquet geometries into a GeoJSON FeatureCollection.
 */
import type { FeatureCollection, Feature } from 'geojson'
import { withConnection, loadSpatial, escapeSql, quoteIdent, normalizeRow } from '@/lib/duckdb/client'

const GEOM_CANDIDATES = ['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape']

export async function readGeoParquetToGeoJSON(source: string | File): Promise<FeatureCollection> {
    return withConnection(async (conn, db) => {
        await loadSpatial(conn)
        // Disabling automatic conversion yields raw WKB, which ST_GeomFromWKB safely handles
        await conn.query('SET enable_geoparquet_conversion = false')

        let tableSource: string
        let virtualName: string | null = null

        if (typeof source === 'string') {
            tableSource = `read_parquet('${escapeSql(source)}')`
        } else {
            virtualName = `user-upload-${crypto.randomUUID()}.parquet`
            const buffer = new Uint8Array(await source.arrayBuffer())
            await db.registerFileBuffer(virtualName, buffer)
            tableSource = `read_parquet('${virtualName}')`
        }

        try {
            // Discover geometry column
            const described = await conn.query(`DESCRIBE SELECT * FROM ${tableSource}`)
            const columns = described.toArray().map(r => String((r.toJSON() as Record<string, unknown>).column_name))

            const geomCol =
                GEOM_CANDIDATES.find(c => columns.includes(c)) ||
                columns.find(c => {
                    const row = described.toArray().find(r => String((r.toJSON() as Record<string, unknown>).column_name) === c)
                    const colType = String((row?.toJSON() as Record<string, unknown>)?.column_type || '').toUpperCase()
                    return colType.includes('GEOMETRY') || colType.includes('BLOB') || colType.includes('BYTEA')
                })

            if (!geomCol) {
                throw new Error('Parquet file contains no recognized geometry column (expected "geom", "geometry", or WKB column).')
            }

            const query = `
                SELECT
                    ST_AsGeoJSON(ST_GeomFromWKB(${quoteIdent(geomCol)})) AS __geom__,
                    * EXCLUDE (${quoteIdent(geomCol)})
                FROM ${tableSource}
            `
            const result = await conn.query(query)

            const features: Feature[] = []
            for (const row of result.toArray()) {
                const obj = row.toJSON() as Record<string, unknown>
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
                        // Skip unparseable geometry
                    }
                }
            }

            return {
                type: 'FeatureCollection',
                features,
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
