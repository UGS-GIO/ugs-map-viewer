import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RelatedTable } from '@/lib/types/mapping-types';

/**
 * Related-table reads, shared by popups and the whole-layer download.
 *
 * The interesting behaviour is the dispatch between backends and, for the bulk
 * path, the chunking that keeps a thousand join keys from becoming one URL the
 * server rejects.
 */

const parquetCalls: Array<Record<string, unknown>> = [];
vi.mock('@/lib/duckdb/client', () => ({
    queryParquetByValues: vi.fn(async (opts: Record<string, unknown>) => {
        parquetCalls.push(opts);
        return [{ uwi: 'a', box: 1 }];
    }),
    queryParquetAll: vi.fn(async (opts: Record<string, unknown>) => {
        parquetCalls.push({ all: true, ...opts });
        return [{ uwi: 'a' }, { uwi: 'b' }];
    }),
}));

import { fetchRelatedRows, fetchRelatedRowsBulk, groupRelatedRows, relatedRowsToCsv } from '@/lib/related-table-fetch';

/** `fieldLabel` is the only required member; everything else is per-test. */
const table = (overrides: Partial<RelatedTable>): RelatedTable => ({ fieldLabel: 'Related', ...overrides });

const fetchCalls: string[] = [];

beforeEach(() => {
    parquetCalls.length = 0;
    fetchCalls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        fetchCalls.push(String(url));
        return { ok: true, status: 200, json: async () => [{ uwi: 'a', n: 1 }] };
    }));
});

const postgrest = table({ url: 'https://api.org/boxes', matchingField: 'uwi' });
const parquet = table({ url: 'https://x.org/boxes.parquet', matchingField: 'uwi', fetchMode: 'parquet' });

describe('fetchRelatedRows', () => {
    it('reads a parquet asset through duckdb rather than HTTP', async () => {
        const rows = await fetchRelatedRows(parquet, ['a', 'b']);
        expect(rows).toEqual([{ uwi: 'a', box: 1 }]);
        expect(parquetCalls[0]).toMatchObject({ matchingField: 'uwi', values: ['a', 'b'] });
        expect(fetchCalls).toEqual([]);
    });

    it('builds a PostgREST `in.()` filter for the default backend', async () => {
        await fetchRelatedRows(postgrest, ['a', 'b']);
        expect(fetchCalls[0]).toBe('https://api.org/boxes?uwi=in.(a,b)');
    });

    it('dedupes and drops blank join keys before asking for anything', async () => {
        await fetchRelatedRows(postgrest, ['a', 'a', '', 'b']);
        expect(fetchCalls[0]).toContain('in.(a,b)');
    });

    it('asks for nothing at all when there are no keys', async () => {
        await expect(fetchRelatedRows(postgrest, ['', ''])).resolves.toEqual([]);
        expect(fetchCalls).toEqual([]);
        expect(parquetCalls).toEqual([]);
    });

    it('orders by every configured key', async () => {
        await fetchRelatedRows({ ...postgrest, sortBy: ['box', 'depth'], sortDirection: 'desc' }, ['a']);
        expect(fetchCalls[0]).toContain('order=box.desc,depth.desc');
    });

    it('sends a CQL filter for a WFS-backed table', async () => {
        await fetchRelatedRows(
            table({ url: 'https://geo.org/wfs', matchingField: 'uwi', fetchMode: 'wfs', wfsTypeName: 'ns:boxes' }),
            ['a'],
        );
        const url = new URL(fetchCalls[0]);
        expect(url.searchParams.get('request')).toBe('GetFeature');
        expect(url.searchParams.get('typeName')).toBe('ns:boxes');
        expect(url.searchParams.get('CQL_FILTER')).toBe("uwi IN ('a')");
    });

    it('returns an empty list when the server errors, so one table cannot break a popup', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
        await expect(fetchRelatedRows(postgrest, ['a'])).resolves.toEqual([]);
    });

    it('wraps a single returned object into a list', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ uwi: 'a' }) })));
        await expect(fetchRelatedRows(postgrest, ['a'])).resolves.toEqual([{ uwi: 'a' }]);
    });
});

describe('fetchRelatedRowsBulk', () => {
    it('reads a parquet asset whole, with no join-key filter at all', async () => {
        const rows = await fetchRelatedRowsBulk(parquet, ['a']);
        expect(rows).toHaveLength(2);
        expect(parquetCalls[0]).toMatchObject({ all: true, url: parquet.url });
    });

    it('splits a large key set into requests a server will accept', async () => {
        const keys = Array.from({ length: 750 }, (_, i) => `k${i}`);
        await fetchRelatedRowsBulk(postgrest, keys);
        // 750 keys at 300 per request.
        expect(fetchCalls).toHaveLength(3);
        expect(fetchCalls[0].split(',')).toHaveLength(300);
    });

    it('concatenates every chunk’s rows', async () => {
        const keys = Array.from({ length: 400 }, (_, i) => `k${i}`);
        const rows = await fetchRelatedRowsBulk(postgrest, keys);
        expect(rows).toHaveLength(2);
    });

    it('does nothing without a join field', async () => {
        await expect(fetchRelatedRowsBulk(table({ url: 'https://api.org/x' }), ['a'])).resolves.toEqual([]);
    });
});

describe('groupRelatedRows', () => {
    it('buckets rows under their join value', () => {
        const map = groupRelatedRows([{ uwi: 'a', n: 1 }, { uwi: 'b', n: 2 }, { uwi: 'a', n: 3 }], 'uwi');
        expect(map.get('a')).toHaveLength(2);
        expect(map.get('b')).toHaveLength(1);
    });

    it('keys on the string form, matching how the popup looks rows up', () => {
        const map = groupRelatedRows([{ id: 7 }], 'id');
        expect(map.get('7')).toEqual([{ id: 7 }]);
    });

    it('drops rows whose join value is missing rather than grouping them under ""', () => {
        const map = groupRelatedRows([{ uwi: null }, { uwi: '' }, { uwi: 'a' }], 'uwi');
        expect([...map.keys()]).toEqual(['a']);
    });
});

describe('relatedRowsToCsv', () => {
    it('dumps every column when the table configures no display fields', () => {
        const csv = relatedRowsToCsv([{ uwi: 'a', box: 1 }], table({ matchingField: 'uwi' }));
        expect(csv.split('\n')[0]).toBe('uwi,box');
    });

    it('prepends the join key so exported rows can be tied back to a feature', () => {
        const csv = relatedRowsToCsv(
            [{ uwi: 'a', box_no: 3 }],
            table({ matchingField: 'uwi', displayFields: [{ field: 'box_no', label: 'Box #' }] }),
        );
        const [header, row] = csv.split('\n');
        expect(header).toBe('uwi,Box #');
        expect(row).toBe('a,3');
    });

    it('does not repeat the join key when it is already a display field', () => {
        const config = table({
            matchingField: 'uwi',
            displayFields: [{ field: 'uwi', label: 'uwi' }, { field: 'box_no', label: 'Box #' }],
        });
        expect(relatedRowsToCsv([{ uwi: 'a', box_no: 3 }], config).split('\n')[0]).toBe('uwi,Box #');
    });

    it('applies a display field’s transform, keeping a link’s target rather than a React element', () => {
        const config = table({
            matchingField: 'uwi',
            displayFields: [{ field: 'photo', label: 'Photo', transform: () => 'https://x.org/p.jpg' }],
        });
        expect(relatedRowsToCsv([{ uwi: 'a', photo: 'p' }], config)).toContain('https://x.org/p.jpg');
    });

    it('survives an empty result set', () => {
        expect(() => relatedRowsToCsv([], table({ matchingField: 'uwi' }))).not.toThrow();
    });
});
