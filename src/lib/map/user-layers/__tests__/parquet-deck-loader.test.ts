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
/** Queries issued through the streaming API rather than materialized whole. */
const streamed: string[] = []
let routes: Array<[RegExp, ReturnType<typeof result>]> = []

function lookup(sql: string) {
    for (const [re, res] of routes) if (re.test(sql)) return res
    return result([])
}

const conn = {
    query: vi.fn(async (sql: string) => {
        queries.push(sql)
        return lookup(sql)
    }),
    // Mirrors duckdb-wasm's `send`: an async iterable of record batches.
    send: vi.fn(async (sql: string) => {
        queries.push(sql)
        streamed.push(sql)
        const res = lookup(sql)
        return (async function* () { yield res })()
    }),
}

type ArrowLike = { toArray: () => { toJSON: () => unknown }[] }
type StreamConn = { query: (sql: string) => Promise<ArrowLike>; send?: (sql: string) => Promise<AsyncIterable<ArrowLike>> }

/** Same contract as the real helpers, over the scripted connection above. */
function* fakeResultRows(result: ArrowLike): Generator<Record<string, unknown>> {
    for (const row of result.toArray()) {
        const json = row.toJSON()
        if (typeof json === 'object' && json !== null && !Array.isArray(json)) yield { ...json }
    }
}

async function* fakeStreamRows(c: StreamConn, sql: string): AsyncGenerator<Record<string, unknown>> {
    if (!c.send) {
        yield* fakeResultRows(await c.query(sql))
        return
    }
    for await (const batch of await c.send(sql)) yield* fakeResultRows(batch)
}

vi.mock('@/lib/duckdb/client', () => ({
    withConnection: vi.fn(async (fn: (c: unknown, d: unknown) => unknown) =>
        fn(conn, { registerFileHandle: vi.fn(), registerFileBuffer: vi.fn(), dropFile: vi.fn() })),
    loadSpatial: vi.fn(),
    streamRows: fakeStreamRows,
    resultRows: fakeResultRows,
    escapeSql: (s: string) => s.replace(/'/g, "''"),
    quoteIdent: (s: string) => `"${s.replace(/"/g, '""')}"`,
    normalizeRow: (row: Record<string, unknown>) => row,
}))

import {
    loadParquetForDeck,
    queryParquetRowProperties,
    queryPointsInViewport,
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
        // The point table's count and extent, read as one aggregate.
        [/min\("__x__"\)/, result([{ n: 2, minx: -111.6, miny: 40.2, maxx: -111.5, maxy: 40.3 }])],
    ]
}

beforeEach(() => {
    queries.length = 0
    streamed.length = 0
    conn.query.mockClear()
    conn.send.mockClear()
})

describe('large-source guard', () => {
    it('does not count rows when no guard is attached, keeping the load single-pass', async () => {
        lonLatSource(5_000_000)
        await loadParquetForDeck('https://x.org/wells.parquet')
        // The guard's count is over the source file; materializing points counts
        // its own table, which is cheap and unrelated.
        expect(queries.some(q => /count\(\*\).*read_parquet/s.test(q))).toBe(false)
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
    it('keeps attributes and coordinates in DuckDB, reporting only the count', async () => {
        lonLatSource(2)
        const data = await loadParquetForDeck('https://x.org/wells.parquet')

        expect(data.kind).toBe('points')
        expect(data.points?.count).toBe(2)
        // The attribute table is the handle used for click lookups and for the
        // viewport reads that feed the GPU.
        expect(data.attrTable).toMatch(/^pq_pts_/)
    })

    it('never walks the point rows at load time', async () => {
        lonLatSource(2)
        await loadParquetForDeck('https://x.org/wells.parquet')
        // Only the aggregate touches the point table; a per-row read would be
        // a million rows through JS for a file this size.
        const rowReads = queries.filter(q => /FROM "pq_pts_/.test(q) && !/count\(\*\)/.test(q))
        expect(rowReads).toEqual([])
    })

    it('computes bounds from the point table\u2019s extent', async () => {
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

describe('uploaded files', () => {
    it('registers the bytes as a buffer, not a BROWSER_FILEREADER handle', async () => {
        // The handle path reports a file size of 0 to DuckDB, so the first footer
        // read dies with "Prefetch registered for bytes outside file ... size: 0".
        lonLatSource(2)
        const registerFileBuffer = vi.fn()
        const registerFileHandle = vi.fn()
        const { withConnection } = await import('@/lib/duckdb/client')
        const run = vi.mocked(withConnection) as unknown as {
            mockImplementationOnce: (impl: (fn: (c: unknown, d: unknown) => unknown) => unknown) => void
        }
        run.mockImplementationOnce(async fn =>
            fn(conn, { registerFileBuffer, registerFileHandle, dropFile: vi.fn() }))

        const file = new File([new Uint8Array(16)], 'wells.parquet')
        await loadParquetForDeck(file)

        expect(registerFileBuffer).toHaveBeenCalledOnce()
        expect(registerFileHandle).not.toHaveBeenCalled()
    })

    it('drops the registered file once the read is done', async () => {
        lonLatSource(2)
        const dropFile = vi.fn()
        const { withConnection } = await import('@/lib/duckdb/client')
        const run = vi.mocked(withConnection) as unknown as {
            mockImplementationOnce: (impl: (fn: (c: unknown, d: unknown) => unknown) => unknown) => void
        }
        run.mockImplementationOnce(async fn =>
            fn(conn, { registerFileBuffer: vi.fn(), dropFile }))

        await loadParquetForDeck(new File([new Uint8Array(16)], 'wells.parquet'))
        expect(dropFile).toHaveBeenCalledOnce()
    })
})

describe('row-unbounded reads are streamed', () => {
    // `conn.query` materializes the whole Arrow result as one contiguous buffer
    // in DuckDB's 32-bit WASM heap. Any read whose row count is bounded only by
    // the file must go through `send`, or a large layer dies as
    // "malloc of size N failed" before the browser is anywhere near out of memory.
    it('streams every polygon row rather than building one giant result', async () => {
        routes = [
            [/^DESCRIBE/, result([{ column_name: 'geom', column_type: 'GEOMETRY' }])],
            [/ST_GeometryType/, result([{ gtype: 'POLYGON' }])],
            [/ST_AsGeoJSON/, result([
                { __geom__: '{"type":"Point","coordinates":[1,2]}', name: 'a' },
            ])],
        ]
        await loadParquetForDeck('https://x.org/units.parquet')
        expect(streamed.some(q => /ST_AsGeoJSON/.test(q))).toBe(true)
    })

    it('streams the viewport slice rather than materializing it', async () => {
        viewportSource(2, [{ rid: 0, x: -111.5, y: 40.2 }, { rid: 1, x: -111.6, y: 40.3 }])
        await queryPointsInViewport('pq_pts_a', [-112, 40, -111, 41])
        expect(streamed.some(q => /AS rid/.test(q))).toBe(true)
    })

    it('still works where the connection has no streaming API', async () => {
        lonLatSource(2)
        const noSend = { query: conn.query }
        const { withConnection } = await import('@/lib/duckdb/client')
        const run = vi.mocked(withConnection) as unknown as {
            mockImplementationOnce: (impl: (fn: (c: unknown, d: unknown) => unknown) => unknown) => void
        }
        run.mockImplementationOnce(async fn => fn(noSend, { dropFile: vi.fn() }))
        const data = await loadParquetForDeck('https://x.org/wells.parquet')
        expect(data.points?.count).toBe(2)
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

/** A point table with `inView` rows in the viewport, returning `rows`. */
function viewportSource(inView: number, rows: Record<string, unknown>[]) {
    routes = [
        [/count\(\*\) AS n FROM "pq_pts_/, result([{ n: inView }])],
        [/AS rid/, result(rows)],
    ]
}

describe('viewport slicing', () => {
    it('draws every point when the viewport holds fewer than the cap', async () => {
        viewportSource(2, [{ rid: 0, x: -111.5, y: 40.2 }, { rid: 1, x: -111.6, y: 40.3 }])
        const view = await queryPointsInViewport('pq_pts_a', [-112, 40, -111, 41], 100)

        expect(view.stride).toBe(1)
        expect(view.count).toBe(2)
        expect(queries.some(q => /AS rid/.test(q) && /%/.test(q))).toBe(false)
    })

    it('thins by row id once the viewport holds more than the cap', async () => {
        viewportSource(10, [{ rid: 0, x: -111.5, y: 40.2 }, { rid: 3, x: -111.6, y: 40.3 }])
        const view = await queryPointsInViewport('pq_pts_a', [-112, 40, -111, 41], 4)

        // 10 in view, cap 4 -> every 3rd, which is a stable subset across pans
        // rather than a fresh random sample that would shimmer.
        expect(view.stride).toBe(3)
        expect(queries.some(q => /"__rid__" % 3 = 0/.test(q))).toBe(true)
        expect(view.inView).toBe(10)
    })

    it('keeps each drawn point\u2019s row id, so a click still finds its row', async () => {
        viewportSource(10, [{ rid: 0, x: -111.5, y: 40.2 }, { rid: 3, x: -111.6, y: 40.3 }])
        const view = await queryPointsInViewport('pq_pts_a', [-112, 40, -111, 41], 4)

        expect([...view.rowIds]).toEqual([0, 3])
        expect(view.positions[0]).toBeCloseTo(-111.5, 4)
        expect(view.positions[3]).toBeCloseTo(40.3, 4)
    })

    it('returns an empty slice when the viewport holds nothing', async () => {
        viewportSource(0, [])
        const view = await queryPointsInViewport('pq_pts_a', [0, 0, 1, 1])

        expect(view.count).toBe(0)
        expect(queries.some(q => /AS rid/.test(q))).toBe(false)
    })

    it('bounds the viewport read to the requested box', async () => {
        viewportSource(2, [{ rid: 0, x: -111.5, y: 40.2 }])
        await queryPointsInViewport('pq_pts_a', [-112, 40, -111, 41], 100)

        const read = queries.find(q => /AS rid/.test(q))
        expect(read).toMatch(/"__x__" BETWEEN -112 AND -111/)
        expect(read).toMatch(/"__y__" BETWEEN 40 AND 41/)
    })
})
