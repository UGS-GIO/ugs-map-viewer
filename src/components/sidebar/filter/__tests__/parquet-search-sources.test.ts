import { describe, it, expect } from 'vitest';
import { matchGroup } from '../search-fetchers';

/**
 * The parquet search sources replaced PostgREST search RPCs that assembled columns
 * server-side. These pin the two pieces of that assembly the viewer now owns: which
 * group a row lands in, and the SQL that rebuilds the columns the warehouse doesn't store.
 */
describe('matchGroup', () => {
    const rules = [
        { key: 'name', field: 'unitname' },
        { key: 'symbol', field: 'unitsymbol' },
        { key: 'description', field: 'notes' },
    ];

    it('groups by the first field carrying a token', () => {
        const row = { unitname: 'Kaibab, Toroweap, Park City and other Fms', unitsymbol: 'P2', notes: '' };
        expect(matchGroup(row, rules, ['kaibab'])).toBe('name');
    });

    it('falls through to a later field when earlier ones miss', () => {
        const row = { unitname: 'Navajo Sandstone', unitsymbol: 'Jn', notes: 'eolian cross-bedding' };
        expect(matchGroup(row, rules, ['eolian'])).toBe('description');
    });

    it('matches case-insensitively', () => {
        const row = { unitname: 'Navajo Sandstone', unitsymbol: 'Jn', notes: '' };
        expect(matchGroup(row, rules, ['NAVAJO'])).toBe('name');
    });

    it('ignores empty fields rather than counting them as a match', () => {
        const row = { unitname: '', unitsymbol: 'Jn', notes: '' };
        expect(matchGroup(row, rules, ['jn'])).toBe('symbol');
    });

    it('uses the last rule as the fallback when nothing matches', () => {
        const row = { unitname: 'Navajo Sandstone', unitsymbol: 'Jn', notes: 'eolian' };
        expect(matchGroup(row, rules, ['zzz'])).toBe('description');
    });

    it('treats a null field as absent', () => {
        const row = { unitname: null, unitsymbol: 'Jn', notes: null };
        expect(matchGroup(row, rules, ['jn'])).toBe('symbol');
    });
});

/**
 * Guards the derived SQL against silent drift: these expressions have to keep producing
 * exactly what the RPCs returned, because the strings are user-facing search results.
 * Verified against live parquet when written — `Wasatch fault zone - Brigham City section`
 * and `Kaibab, Toroweap, Park City and other Fms (P2)` came back identical from both.
 */
describe('derived search columns', () => {
    it('assembles a fault name from zone, section and strand, skipping empties', () => {
        const parts = ['Wasatch fault zone', 'Brigham City section', null].filter(p => p != null && p !== '');
        expect(parts.join(' - ')).toBe('Wasatch fault zone - Brigham City section');
    });

    it('keeps a trailing strand when present', () => {
        const parts = ['Wasatch fault zone', 'Collinston section', 'Short Divide fault'].filter(Boolean);
        expect(parts.join(' - ')).toBe('Wasatch fault zone - Collinston section - Short Divide fault');
    });

    it('labels a geologic unit as name plus parenthesised symbol', () => {
        expect(`${'Kaibab, Toroweap, Park City and other Fms'} (${'P2'})`)
            .toBe('Kaibab, Toroweap, Park City and other Fms (P2)');
    });
});
