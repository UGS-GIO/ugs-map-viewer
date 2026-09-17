import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The remote-parquet readers, exercised against a scripted DuckDB connection.
 *
 * These are the paths behind popup related tables and the whole-layer download,
 * so the cases that matter are the ones a mocked single-batch result would hide:
 * a result that arrives as several record batches, and a connection with no
 * streaming API at all.
 */

interface Row { [key: string]: unknown }

/** An Arrow-ish result: `toArray()` of row objects. */
function result(rows: Row[]) {
    return { toArray: () => rows.map(r => ({ toJSON: () => r })) };
}

const queries: string[] = [];
const streamed: string[] = [];
/** Batches each query streams back, keyed by a pattern matched against the SQL. */
let batches: Array<[RegExp, Row[][]]> = [];

function lookup(sql: string): Row[][] {
    for (const [re, rows] of batches) if (re.test(sql)) return rows;
    return [[]];
}

const conn = {
    query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return result(lookup(sql).flat());
    }),
    send: vi.fn(async (sql: string) => {
        queries.push(sql);
        streamed.push(sql);
        const parts = lookup(sql);
        return (async function* () { for (const rows of parts) yield result(rows); })();
    }),
    close: vi.fn(async () => undefined),
};

vi.mock('@duckdb/duckdb-wasm', () => {
    class AsyncDuckDB {
        async instantiate() { /* no wasm in tests */ }
        async open() { /* no-op */ }
        async connect() { return conn; }
    }
    return {
        AsyncDuckDB,
        ConsoleLogger: class { },
        getJsDelivrBundles: () => ({}),
        selectBundle: async () => ({ mainModule: 'm.wasm', mainWorker: 'w.js', pthreadWorker: null }),
    };
});

vi.stubGlobal('Worker', class { terminate() { } });
vi.stubGlobal('URL', Object.assign(globalThis.URL, {
    createObjectURL: () => 'blob:worker',
    revokeObjectURL: () => undefined,
}));

import {
    streamRows,
    queryParquetByValues,
    queryParquetAll,
    queryParquetDistinctValues,
    queryParquetFieldOptions,
    queryParquetFieldExtent,
    normalizeRow,
} from '@/lib/duckdb/client';

const URL_ = 'https://x.org/wells.parquet';

beforeEach(() => {
    queries.length = 0;
    streamed.length = 0;
    conn.query.mockClear();
    conn.send.mockClear();
    batches = [];
});

describe('streamRows', () => {
    it('yields every row across record batches, not just the first', async () => {
        batches = [[/SELECT/, [[{ n: 1 }, { n: 2 }], [{ n: 3 }], [{ n: 4 }, { n: 5 }]]]];
        const out: unknown[] = [];
        for await (const row of streamRows(conn, 'SELECT n')) out.push(row.n);
        expect(out).toEqual([1, 2, 3, 4, 5]);
    });

    it('falls back to a materialized query when the connection cannot stream', async () => {
        batches = [[/SELECT/, [[{ n: 1 }], [{ n: 2 }]]]];
        const noSend = { query: conn.query };
        const out: unknown[] = [];
        for await (const row of streamRows(noSend, 'SELECT n')) out.push(row.n);
        expect(out).toEqual([1, 2]);
        expect(conn.send).not.toHaveBeenCalled();
    });

    it('skips rows that are not field bags rather than yielding junk', async () => {
        batches = [[/SELECT/, [[{ n: 1 }, null as unknown as Row, { n: 2 }]]]];
        const out: unknown[] = [];
        for await (const row of streamRows(conn, 'SELECT n')) out.push(row.n);
        expect(out).toEqual([1, 2]);
    });

    it('hands back a copy, so a consumer mutating a row cannot corrupt the batch', async () => {
        const row: Row = { n: 1 };
        batches = [[/SELECT/, [[row]]]];
        for await (const r of streamRows(conn, 'SELECT n')) delete r.n;
        expect(row.n).toBe(1);
    });
});

describe('queryParquetByValues', () => {
    it('streams the result rather than materializing it', async () => {
        batches = [[/read_parquet/, [[{ uwi: 'a' }], [{ uwi: 'b' }]]]];
        const rows = await queryParquetByValues({ url: URL_, matchingField: 'uwi', values: ['a', 'b'] });
        expect(rows).toEqual([{ uwi: 'a' }, { uwi: 'b' }]);
        expect(streamed.some(q => /read_parquet/.test(q))).toBe(true);
    });

    it('dedupes the join keys and drops blanks before building the IN list', async () => {
        batches = [[/read_parquet/, [[{ uwi: 'a' }]]]];
        await queryParquetByValues({ url: URL_, matchingField: 'uwi', values: ['a', 'a', '', 'b'] });
        expect(queries[0]).toContain("IN ('a','b')");
    });

    it('compares as VARCHAR, so a numeric join column still matches quoted keys', async () => {
        batches = [[/read_parquet/, [[{ box_pk: 1 }]]]];
        await queryParquetByValues({ url: URL_, matchingField: 'box_pk', values: ['1'] });
        expect(queries[0]).toMatch(/CAST\("box_pk" AS VARCHAR\) IN/);
    });

    it('runs no query at all when there is nothing to match', async () => {
        const rows = await queryParquetByValues({ url: URL_, matchingField: 'uwi', values: ['', ''] });
        expect(rows).toEqual([]);
        expect(conn.query).not.toHaveBeenCalled();
        expect(conn.send).not.toHaveBeenCalled();
    });

    it('orders by every key it is given', async () => {
        batches = [[/read_parquet/, [[{ uwi: 'a' }]]]];
        await queryParquetByValues({
            url: URL_, matchingField: 'uwi', values: ['a'],
            sortBy: ['box_no', 'depth'], sortDirection: 'desc',
        });
        expect(queries[0]).toMatch(/ORDER BY "box_no" DESC, "depth" DESC/);
    });

    it('escapes a quote in a join key instead of breaking out of the literal', async () => {
        batches = [[/read_parquet/, [[{ uwi: "o'brien" }]]]];
        await queryParquetByValues({ url: URL_, matchingField: 'uwi', values: ["o'brien"] });
        expect(queries[0]).toContain("'o''brien'");
    });

    it('normalizes bigint cells the popup pipeline cannot render', async () => {
        batches = [[/read_parquet/, [[{ box_pk: 7n, huge: 2n ** 70n }]]]];
        const rows = await queryParquetByValues({ url: URL_, matchingField: 'uwi', values: ['a'] });
        expect(rows[0].box_pk).toBe(7);
        expect(rows[0].huge).toBe(String(2n ** 70n));
    });
});

describe('queryParquetAll', () => {
    it('streams a whole related table across batches', async () => {
        batches = [[/read_parquet/, [[{ id: 1 }, { id: 2 }], [{ id: 3 }]]]];
        const rows = await queryParquetAll({ url: URL_ });
        expect(rows.map(r => r.id)).toEqual([1, 2, 3]);
        expect(streamed).toHaveLength(1);
    });

    it('reads the file unfiltered — the asset is already scoped to the layer', async () => {
        batches = [[/read_parquet/, [[{ id: 1 }]]]];
        await queryParquetAll({ url: URL_ });
        expect(queries[0]).not.toMatch(/WHERE/);
    });

    it('applies the configured sort', async () => {
        batches = [[/read_parquet/, [[{ id: 1 }]]]];
        await queryParquetAll({ url: URL_, sortBy: 'depth', sortDirection: 'asc' });
        expect(queries[0]).toMatch(/ORDER BY "depth" ASC/);
    });

    it('returns an empty list for an empty file instead of throwing', async () => {
        batches = [[/read_parquet/, [[]]]];
        await expect(queryParquetAll({ url: URL_ })).resolves.toEqual([]);
    });
});

describe('queryParquetDistinctValues', () => {
    it('collects the keys across batches and drops non-strings', async () => {
        batches = [[/DISTINCT/, [[{ v: 'a' }, { v: null }], [{ v: 'b' }]]]];
        const values = await queryParquetDistinctValues({ url: URL_, field: 'uwi' });
        expect(values).toEqual(['a', 'b']);
    });
});

describe('filter reads', () => {
    it('materializes only the column being filtered, not the whole file', async () => {
        batches = [
            [/DESCRIBE/, [[{ column_name: 'purpose' }, { column_name: 'geom' }]]],
            [/GROUP BY/, [[{ v: 'Coal', n: 3n }]]],
        ];
        await queryParquetFieldOptions({ url: URL_, field: 'purpose' });
        const create = queries.find(q => /CREATE TABLE IF NOT EXISTS/.test(q));
        expect(create).toContain('"purpose"');
        // `* EXCLUDE (geom)` here is every attribute column of the file.
        expect(create).not.toMatch(/EXCLUDE/);
    });

    it('counts values from the projected table', async () => {
        batches = [[/GROUP BY/, [[{ v: 'Coal', n: 3n }, { v: 'Water', n: 1n }]]]];
        const { options, counts } = await queryParquetFieldOptions({ url: URL_, field: 'purpose' });
        expect(options).toEqual(['Coal', 'Water']);
        expect(counts).toEqual({ Coal: 3, Water: 1 });
    });

    it('reads a range slider’s rails from the same single-column table', async () => {
        batches = [[/MIN\(/, [[{ lo: 0, hi: 12000 }]]]];
        const extent = await queryParquetFieldExtent({ url: URL_, field: 'td_ft' });
        expect(extent).toEqual({ min: 0, max: 12000 });
        const create = queries.find(q => /CREATE TABLE IF NOT EXISTS/.test(q));
        expect(create).toContain('"td_ft"');
    });
});

describe('normalizeRow', () => {
    it('keeps a bigint that fits and stringifies one that does not', () => {
        expect(normalizeRow({ a: 5n, b: 2n ** 70n })).toEqual({ a: 5, b: String(2n ** 70n) });
    });

    it('passes primitives through and nulls out undefined', () => {
        expect(normalizeRow({ s: 'x', n: 1, b: true, u: undefined, z: null }))
            .toEqual({ s: 'x', n: 1, b: true, u: null, z: null });
    });

    it('stringifies anything else, so a struct cell cannot reach the popup as an object', () => {
        expect(normalizeRow({ o: { a: 1 } }).o).toBe(String({ a: 1 }));
    });
});
