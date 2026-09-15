import { describe, it, expect } from 'vitest';
import { orderedCategories } from '../symbology-legend';

/**
 * The category list must survive a filter on another field — building it from filtered rows
 * is what made categories disappear when the symbology was switched.
 */
describe('orderedCategories', () => {
    const allValues = ['CUTTINGS', 'WHOLE CORE', 'SLABS', 'CORE'];

    it('keeps every category even when the filter leaves only one with rows', () => {
        const result = orderedCategories(allValues, ['CORE'], { CORE: 1 });
        expect(result).toHaveLength(4);
        expect(result).toContain('CUTTINGS');
        expect(result).toContain('WHOLE CORE');
    });

    it('orders by current match count, highest first', () => {
        const counts = { CUTTINGS: 4782, 'WHOLE CORE': 870, SLABS: 633, CORE: 1 };
        expect(orderedCategories(allValues, allValues, counts))
            .toEqual(['CUTTINGS', 'WHOLE CORE', 'SLABS', 'CORE']);
    });

    it('breaks ties alphabetically', () => {
        const counts = { CUTTINGS: 5, SLABS: 5, CORE: 5, 'WHOLE CORE': 5 };
        expect(orderedCategories(allValues, allValues, counts))
            .toEqual(['CORE', 'CUTTINGS', 'SLABS', 'WHOLE CORE']);
    });

    it('sorts a filtered-out category to the end rather than dropping it', () => {
        const result = orderedCategories(allValues, ['CUTTINGS'], { CUTTINGS: 4782 });
        expect(result[0]).toBe('CUTTINGS');
        expect(result).toContain('CORE');
    });

    it('falls back to the filtered list while the unfiltered query is still loading', () => {
        expect(orderedCategories(undefined, ['CORE', 'SLABS'], { SLABS: 2, CORE: 1 }))
            .toEqual(['SLABS', 'CORE']);
    });

    it('is empty when neither query has returned', () => {
        expect(orderedCategories(undefined, undefined, undefined)).toEqual([]);
    });

    it('treats a missing count as zero instead of dropping the value', () => {
        expect(orderedCategories(['A', 'B'], ['B'], { B: 3 })).toEqual(['B', 'A']);
    });

    it('does not mutate the array it was handed', () => {
        const input = ['B', 'A'];
        orderedCategories(input, input, { A: 9 });
        expect(input).toEqual(['B', 'A']);
    });
});
