import type { FeatureCollection, Feature } from 'geojson'
import { withConnection, loadSpatial, escapeSql, quoteIdent, normalizeRow } from '@/lib/duckdb/client'

const GEOM_CANDIDATES = ['geom', 'geometry', 'wkb_geometry', 'the_geom', 'shape']

export interface ParquetDeckData {
    kind: 'points' | 'geojson'
    points?: {
        positions: Float32Array
        count: number
    }
    geojson?: FeatureCollection
    properties?: Array<Record<string, unknown>>
    bounds?: [number, number, number, number]
}

export async function loadParquetForDeck(source: string | File): Promise<ParquetDeckData> {
    return withConnection(async (conn, db) => {
        await loadSpatial(conn)
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

            // Coordinate columns
            if (lonCol && latCol && !geomCol) {
                const pointsQuery = `
                    SELECT
                        ${quoteIdent(lonCol)}::FLOAT AS x,
                        ${quoteIdent(latCol)}::FLOAT AS y
                    FROM ${tableSource}
                    WHERE ${quoteIdent(lonCol)} IS NOT NULL AND ${quoteIdent(latCol)} IS NOT NULL
                `
                const ptsTable = await conn.query(pointsQuery)
                const count = ptsTable.numRows
                const xArray = ptsTable.getChild('x')?.toArray() as Float32Array | undefined
                const yArray = ptsTable.getChild('y')?.toArray() as Float32Array | undefined

                const positions = new Float32Array(count * 2)
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

                if (xArray && yArray) {
                    for (let i = 0; i < count; i++) {
                        const px = xArray[i]
                        const py = yArray[i]
                        positions[i * 2] = px
                        positions[i * 2 + 1] = py
                        if (px < minX) minX = px
                        if (py < minY) minY = py
                        if (px > maxX) maxX = px
                        if (py > maxY) maxY = py
                    }
                }

                const propsTable = await conn.query(`SELECT * FROM ${tableSource} LIMIT 50000`)
                const properties = propsTable.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>))

                return {
                    kind: 'points',
                    points: { positions, count },
                    properties,
                    bounds: minX !== Infinity ? [minX, minY, maxX, maxY] : undefined,
                }
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

            // Points -> binary coordinates
            if (isPoint) {
                const pointsQuery = `
                    SELECT
                        ST_X(ST_GeomFromWKB(${quoteIdent(geomCol)}))::FLOAT AS x,
                        ST_Y(ST_GeomFromWKB(${quoteIdent(geomCol)}))::FLOAT AS y
                    FROM ${tableSource}
                    WHERE ${quoteIdent(geomCol)} IS NOT NULL
                `
                const ptsTable = await conn.query(pointsQuery)
                const count = ptsTable.numRows
                const xArray = ptsTable.getChild('x')?.toArray() as Float32Array | undefined
                const yArray = ptsTable.getChild('y')?.toArray() as Float32Array | undefined

                const positions = new Float32Array(count * 2)
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

                if (xArray && yArray) {
                    for (let i = 0; i < count; i++) {
                        const px = xArray[i]
                        const py = yArray[i]
                        positions[i * 2] = px
                        positions[i * 2 + 1] = py
                        if (px < minX) minX = px
                        if (py < minY) minY = py
                        if (px > maxX) maxX = px
                        if (py > maxY) maxY = py
                    }
                }

                const propsTable = await conn.query(`SELECT * EXCLUDE (${quoteIdent(geomCol)}) FROM ${tableSource} LIMIT 50000`)
                const properties = propsTable.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>))

                return {
                    kind: 'points',
                    points: { positions, count },
                    properties,
                    bounds: minX !== Infinity ? [minX, minY, maxX, maxY] : undefined,
                }
            }

            // Polygons / Lines -> GeoJSON
            const query = `
                SELECT
                    ST_AsGeoJSON(ST_GeomFromWKB(${quoteIdent(geomCol)})) AS __geom__,
                    * EXCLUDE (${quoteIdent(geomCol)})
                FROM ${tableSource}
                LIMIT 100000
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
                        // Skip malformed geometry
                    }
                }
            }

            return {
                kind: 'geojson',
                geojson: {
                    type: 'FeatureCollection',
                    features,
                },
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
