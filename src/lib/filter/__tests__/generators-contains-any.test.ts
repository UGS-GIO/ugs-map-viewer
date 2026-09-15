import { describe, it, expect } from 'vitest';
import { toMaplibreFilter, toSqlPredicates, toCql } from '../generators';
import { fromCql } from '../parse';
import type { FilterSchema, FilterState } from '../types';

const schema: FilterSchema = {
    recordKey: 'Utah Core Research Center Inventory',
    fields: [{ kind: 'containsAny', field: 'box_type_codes', label: 'Sample Type' }],
};

const state = (...values: string[]): FilterState => ({
    box_type_codes: { kind: 'containsAny', values },
});

// box_type_codes is comma-delimited; substring matching made CORE select 1,417 wells, not 1.
describe('containsAny → maplibre', () => {
    it('wraps both the cell and the token in the delimiter', () => {
        expect(toMaplibreFilter(schema, state('CORE'))).toEqual([
            '>=',
            ['index-of', ',CORE,', ['concat', ',', ['coalesce', ['get', 'box_type_codes'], ''], ',']],
            0,
        ]);
    });

    it('ORs multiple tokens, each delimited', () => {
        const filter = toMaplibreFilter(schema, state('CORE', 'CUTTINGS')) as unknown[];
        expect(filter[0]).toBe('any');
        expect(filter).toHaveLength(3);
        expect(JSON.stringify(filter)).toContain(',CORE,');
        expect(JSON.stringify(filter)).toContain(',CUTTINGS,');
    });

    it('never emits an undelimited token, which is what over-matched', () => {
        expect(JSON.stringify(toMaplibreFilter(schema, state('CORE')))).not.toContain('"CORE"');
    });

    it('is null when nothing is selected', () => {
        expect(toMaplibreFilter(schema, state())).toBeNull();
    });
});

describe('containsAny → SQL', () => {
    it('splits the cell and compares tokens rather than pattern-matching', () => {
        expect(toSqlPredicates(schema, state('CORE'))).toEqual([
            `(list_contains(list_transform(string_split(CAST("box_type_codes" AS VARCHAR), ','), x -> trim(x)), 'CORE'))`,
        ]);
    });

    it('leaves LIKE metacharacters inert', () => {
        const [sql] = toSqlPredicates(schema, state('__none__'));
        expect(sql).not.toContain('ILIKE');
        expect(sql).toContain(`'__none__'`);
    });

    it('ORs multiple tokens inside one clause', () => {
        const [sql] = toSqlPredicates(schema, state('CORE', 'SLABS'));
        expect(sql).toContain(`'CORE'`);
        expect(sql).toContain(`'SLABS'`);
        expect(sql).toContain(' OR ');
    });

    it('is empty when nothing is selected', () => {
        expect(toSqlPredicates(schema, state())).toEqual([]);
    });
});

// CQL is URL encoding, not the query that runs — only the round trip has to hold.
describe('containsAny → CQL round trip', () => {
    it('recovers a single value', () => {
        const parsed = fromCql(schema, toCql(schema, state('CORE')));
        expect(parsed.box_type_codes).toEqual({ kind: 'containsAny', values: ['CORE'] });
    });

    it('recovers multiple values in order', () => {
        const parsed = fromCql(schema, toCql(schema, state('CORE', 'CORE CHIPS', 'CUTTINGS')));
        expect(parsed.box_type_codes).toEqual({
            kind: 'containsAny',
            values: ['CORE', 'CORE CHIPS', 'CUTTINGS'],
        });
    });

    it('keeps a value whose name contains another value', () => {
        const parsed = fromCql(schema, toCql(schema, state('CORE', 'WHOLE CORE')));
        expect(parsed.box_type_codes).toEqual({
            kind: 'containsAny',
            values: ['CORE', 'WHOLE CORE'],
        });
    });

    it('produces no clause for an empty selection', () => {
        expect(toCql(schema, state())).toBe('');
    });
});
