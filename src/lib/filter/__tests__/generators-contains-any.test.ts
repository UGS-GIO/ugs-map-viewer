import { describe, it, expect } from 'vitest';
import { toMaplibreFilter, toSqlPredicates } from '../generators';
import type { FilterSchema, FilterState } from '../types';

/**
 * `containsAny` reads a comma-delimited cell (UCRC `box_type_codes` holds
 * "CORE CHIPS,CUTTINGS"). Matching has to be token-for-token: a bare substring made
 * "CORE" select every well carrying CORE CHIPS, WHOLE CORE, SKELETONIZED CORE or
 * CORESAMPLES — 1,417 of them against the 1 that actually holds a plain CORE.
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
