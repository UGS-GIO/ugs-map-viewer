import { describe, it, expect } from 'vitest';
import { toMaplibreFilter, toSqlPredicates, toCql } from '../generators';
import { fromCql } from '../parse';
import type { FilterSchema, FilterState } from '../types';

/**
 * `box_type_codes` holds a comma-delimited cell ("CORE CHIPS,CUTTINGS"), so matching has to
 * be token-for-token — substring matching made `CORE` select 1,417 wells instead of 1.
 */
const schema: FilterSchema = {
    recordKey: 'Utah Core Research Center Inventory',
    fields: [{ kind: 'containsAny', field: 'box_type_codes', label: 'Sample Type' }],
};

const state = (...values: string[]): FilterState => ({
    box_type_codes: { kind: 'containsAny', values },
});

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
    it('delimits both sides so a token only matches a whole token', () => {
        expect(toSqlPredicates(schema, state('CORE'))).toEqual([
            `((',' || CAST("box_type_codes" AS VARCHAR) || ',') ILIKE '%,CORE,%')`,
        ]);
    });

    it('ORs multiple tokens inside one clause', () => {
        const [sql] = toSqlPredicates(schema, state('CORE', 'SLABS'));
        expect(sql).toContain(`'%,CORE,%'`);
        expect(sql).toContain(`'%,SLABS,%'`);
        expect(sql).toContain(' OR ');
    });

    it('matches a token at either end of the cell, not just the middle', () => {
        // ',' || 'CORE CHIPS,CUTTINGS' || ',' = ',CORE CHIPS,CUTTINGS,'
        const cell = ',CORE CHIPS,CUTTINGS,';
        expect(cell.includes(',CUTTINGS,')).toBe(true);
        expect(cell.includes(',CORE CHIPS,')).toBe(true);
        expect(cell.includes(',CORE,')).toBe(false);
    });

    it('is empty when nothing is selected', () => {
        expect(toSqlPredicates(schema, state())).toEqual([]);
    });
});

/**
 * CQL is the URL encoding, not the query that runs, so it still reads `LIKE '%CORE%'`. Only
 * the round trip has to hold — tightening the CQL later means changing `likeValuesForField`.
 */
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
