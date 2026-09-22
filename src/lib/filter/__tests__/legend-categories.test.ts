import { describe, it, expect } from 'vitest';
import { orderedCategories } from '@/lib/filter/legend-categories';

describe('orderedCategories', () => {
    const totals = { CUTTINGS: 4782, 'WHOLE CORE': 871, SLABS: 633, CORE: 2677 };

    it('keeps every category even when the filter leaves only one with rows', () => {
        const result = orderedCategories(totals, { CORE: 1 });
        expect(result).toHaveLength(4);
        expect(result).toContain('CUTTINGS');
        expect(result).toContain('WHOLE CORE');
    });

    it('orders by current match count, highest first', () => {
        expect(orderedCategories(totals, { CUTTINGS: 4782, 'WHOLE CORE': 870, SLABS: 633, CORE: 1 }))
            .toEqual(['CUTTINGS', 'WHOLE CORE', 'SLABS', 'CORE']);
    });

    it('breaks ties alphabetically', () => {
        expect(orderedCategories(totals, { CUTTINGS: 5, SLABS: 5, CORE: 5, 'WHOLE CORE': 5 }))
            .toEqual(['CORE', 'CUTTINGS', 'SLABS', 'WHOLE CORE']);
    });

    it('sorts a filtered-out category to the end rather than dropping it', () => {
        const result = orderedCategories(totals, { CUTTINGS: 4782 });
        expect(result[0]).toBe('CUTTINGS');
        expect(result).toContain('CORE');
    });

    it('is empty before the query returns', () => {
        expect(orderedCategories(undefined, undefined)).toEqual([]);
    });

    it('treats a missing count as zero instead of dropping the value', () => {
        expect(orderedCategories({ A: 10, B: 10 }, { B: 3 })).toEqual(['B', 'A']);
    });
});
