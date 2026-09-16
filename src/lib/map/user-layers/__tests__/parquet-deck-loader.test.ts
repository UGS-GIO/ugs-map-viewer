import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The loader is exercised against a scripted DuckDB connection: each test
 * declares what its queries return, so the guard, the row-id contract, and the
 * geometry-kind routing can be checked without the WASM engine.
 */

/** An Arrow-ish result: `toArray()` of row objects, plus `getChild` for columns. */
function result(rows: Record<string, unknown>[]) {
    return {
        numRows: rows.length,
        toArray: () => rows.map(r => ({ toJSON: () => r })),
        getChild: (name: string) => ({
            toArray: () => Float32Array.from(rows.map(r => Number(r[name] ?? 0))),
        }),
    }
}

const queries: string[] = []
let routes: Array<[RegExp, ReturnType<typeof result>]> = []

const conn = {
    query: vi.fn(async (sql: string) => {
        queries.push(sql)
        for (const [re, res] of routes) if (re.test(sql)) return res
        return result([])
    }),
}

vi.mock('@/lib/duckdb/client', () => ({
    withConnection: vi.fn(async (fn: (c: unknown, d: unknown) => unknown) =>
        fn(conn, { registerFileHandle: vi.fn(), registerFileBuffer: vi.fn(), dropFile: vi.fn() })),
    loadSpatial: vi.fn(),
    escapeSql: (s: string) => s.replace(/'/g, "''"),
    quoteIdent: (s: string) => `"${s.replace(/"/g, '""')}"`,
    normalizeRow: (row: Record<string, unknown>) => row,
}))

import {
    loadParquetForDeck,
    queryParquetRowProperties,
    ParquetLoadCancelledError,
    LARGE_PARQUET_FEATURE_COUNT,
} from '@/lib/map/user-layers/parquet-deck-loader'

/** A source described as having lon/lat columns plus one attribute. */
function lonLatSource(rowCount: number) {
    routes = [
        [/^SELECT count\(\*\)/, result([{ n: rowCount }])],
        [/^DESCRIBE/, result([
            { column_name: 'lon', column_type: 'DOUBLE' },
            { column_name: 'lat', column_type: 'DOUBLE' },
            { column_name: 'name', column_type: 'VARCHAR' },
        ])],
        [/ORDER BY "__rid__"/, result([{ x: -111.5, y: 40.2 }, { x: -111.6, y: 40.3 }])],
    ]
}

beforeEach(() => {
    queries.length = 0
    conn.query.mockClear()
})

describe('large-source guard', () => {
    it('does not count rows when no guard is attached, keeping the load single-pass', async () => {
        lonLatSource(5_000_000)
        await loadParquetForDeck('https://x.org/wells.parquet')
        expect(queries.some(q => /count\(\*\)/.test(q))).toBe(false)
    })

    it('loads without asking when the source is under the threshold', async () => {
        lonLatSource(LARGE_PARQUET_FEATURE_COUNT - 1)
        const onLargeDataset = vi.fn().mockResolvedValue(true)
        await loadParquetForDeck('https://x.org/wells.parquet', { onLargeDataset })
        expect(onLargeDataset).not.toHaveBeenCalled()
    })

    it('asks before materializing once the source is large enough', async () => {
        lonLatSource(250_000)
        const onLargeDataset = vi.fn().mockResolvedValue(true)
        await loadParquetForDeck('https://x.org/wells.parquet', { onLargeDataset, name: 'wells.parquet' })
        expect(onLargeDataset).toHaveBeenCalledWith({ name: 'wells.parquet', featureCount: 250_000 })
    })

    it('counts rows before reading any, so a declined file is never materialized', async () => {
        lonLatSource(250_000)
        const onLargeDataset = vi.fn().mockResolvedValue(false)
        await expect(
            loadParquetForDeck('https://x.org/wells.parquet', { onLargeDataset }),
        ).rejects.toBeInstanceOf(ParquetLoadCancelledError)
        expect(queries.some(q => /CREATE OR REPLACE TABLE/.test(q))).toBe(false)
        expect(queries.some(q => /ST_AsGeoJSON/.test(q))).toBe(false)
    })

    it('reports the count on the loaded data', async () => {
        lonLatSource(250_000)
        const data = await loadParquetForDeck('https://x.org/wells.parquet', {
            onLargeDataset: () => true,
        })
        expect(data.featureCount).toBe(250_000)
    })
})

describe('point materialization', () => {
    it('keeps attributes in DuckDB and returns only coordinates to the browser', async () => {
        lonLatSource(2)
        const data = await loadParquetForDeck('https://x.org/wells.parquet')

        expect(data.kind).toBe('points')
        expect(data.points?.count).toBe(2)
        // Float32 — ~1m of rounding at these longitudes, which is why the popup
        // reads attributes from DuckDB rather than echoing these back.
        const expected = [-111.5, 40.2, -111.6, 40.3]
        data.points!.positions.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 4))
        // The attribute table is the handle used for click lookups.
        expect(data.attrTable).toMatch(/^pq_pts_/)
    })

    it('reads coordinates back ordered by row id, so index and id are the same number', async () => {
        lonLatSource(2)
        await loadParquetForDeck('https://x.org/wells.parquet')
        const read = queries.find(q => /FROM "pq_pts_/.test(q) && /SELECT/.test(q))
        expect(read).toMatch(/ORDER BY "__rid__"/)
    })

    it('computes bounds from the coordinates', async () => {
        lonLatSource(2)
        const data = await loadParquetForDeck('https://x.org/wells.parquet')
        const expected = [-111.6, 40.2, -111.5, 40.3]
        data.bounds!.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 4))
    })

    it('drops the WKB geometry column from the attributes it stores', async () => {
        routes = [
            [/^DESCRIBE/, result([
                { column_name: 'geom', column_type: 'BLOB' },
                { column_name: 'name', column_type: 'VARCHAR' },
            ])],
            [/ST_GeometryType/, result([{ gtype: 'POINT' }])],
            [/ORDER BY "__rid__"/, result([{ x: -112, y: 41 }])],
        ]
        const data = await loadParquetForDeck('https://x.org/wells.parquet')
        expect(data.kind).toBe('points')
        const create = queries.find(q => /CREATE OR REPLACE TABLE/.test(q))
        expect(create).toMatch(/EXCLUDE \("geom"\)/)
    })
})

describe('polygon routing', () => {
    it('sends non-point geometry down the GeoJSON path for client-side tiling', async () => {
        routes = [
            [/^DESCRIBE/, result([{ column_name: 'geom', column_type: 'GEOMETRY' }])],
            [/ST_GeometryType/, result([{ gtype: 'POLYGON' }])],
            [/ST_AsGeoJSON/, result([
                { __geom__: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}', name: 'a' },
            ])],
        ]
        const data = await loadParquetForDeck('https://x.org/units.parquet')
        expect(data.kind).toBe('geojson')
        expect(data.geojson?.features).toHaveLength(1)
        expect(data.geojson?.features[0].properties).toEqual({ name: 'a' })
    })

    it('reads every row — the row cap is gone, the count guard covers size now', async () => {
        routes = [
            [/^DESCRIBE/, result([{ column_name: 'geom', column_type: 'GEOMETRY' }])],
            [/ST_GeometryType/, result([{ gtype: 'POLYGON' }])],
            [/ST_AsGeoJSON/, result([])],
        ]
        await loadParquetForDeck('https://x.org/units.parquet')
        expect(queries.find(q => /ST_AsGeoJSON/.test(q))).not.toMatch(/LIMIT/)
    })

    it('skips rows whose geometry will not parse rather than failing the layer', async () => {
        routes = [
            [/^DESCRIBE/, result([{ column_name: 'geom', column_type: 'GEOMETRY' }])],
            [/ST_GeometryType/, result([{ gtype: 'POLYGON' }])],
            [/ST_AsGeoJSON/, result([
                { __geom__: 'not json', name: 'bad' },
                { __geom__: '{"type":"Point","coordinates":[1,2]}', name: 'good' },
            ])],
        ]
        const data = await loadParquetForDeck('https://x.org/units.parquet')
        expect(data.geojson?.features).toHaveLength(1)
        expect(data.geojson?.features[0].properties).toEqual({ name: 'good' })
    })

    it('rejects a file with neither coordinates nor geometry', async () => {
        routes = [[/^DESCRIBE/, result([{ column_name: 'id', column_type: 'INTEGER' }])]]
        await expect(loadParquetForDeck('https://x.org/plain.parquet')).rejects.toThrow(
            /no recognized geometry or coordinates/,
        )
    })
})

describe('queryParquetRowProperties', () => {
    it('fetches only the clicked rows, keyed by row id', async () => {
        routes = [[/FROM "tbl"/, result([
            { __rid__: 4, name: 'Well 4' },
            { __rid__: 9, name: 'Well 9' },
        ])]]
        const props = await queryParquetRowProperties('tbl', [4, 9])
        expect(props.get(4)).toEqual({ name: 'Well 4' })
        expect(props.get(9)).toEqual({ name: 'Well 9' })
        // The id column is an implementation detail, not an attribute.
        expect(props.get(4)).not.toHaveProperty('__rid__')
        expect(queries[0]).toContain('IN (4,9)')
    })

    it('leaves the coordinate columns out of the popup', async () => {
        routes = [[/FROM "tbl"/, result([{ __rid__: 0 }])]]
        await queryParquetRowProperties('tbl', [0])
        expect(queries[0]).toMatch(/EXCLUDE \("__x__", "__y__"\)/)
    })

    it('runs no query for an empty pick', async () => {
        await queryParquetRowProperties('tbl', [])
        expect(conn.query).not.toHaveBeenCalled()
    })

    it('coerces ids to integers so the inlined list cannot carry anything else', async () => {
        routes = [[/FROM "tbl"/, result([])]]
        await queryParquetRowProperties('tbl', [3.7, Number.NaN, 8] as number[])
        expect(queries[0]).toContain('IN (3,8)')
    })
})
