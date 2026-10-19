import { afterEach, beforeEach, describe, it, expect, vi, type MockInstance } from 'vitest'
import { parseDisplacement } from '../displacement-filter-context'

// The displacement filter state rides in a hand-editable URL param. A malformed
// entry must fall back to defaults (and say so) rather than throw (new Set(5))
// or reach the map cql as year=NaN.
describe('parseDisplacement', () => {
    let warn: MockInstance
    beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
    afterEach(() => { warn.mockRestore() })

    it('keeps state the filter panel writes', () => {
        const state = {
            years: { Cumulative: '2024' },
            thresholds: { Yearly: 1.5 },
            basins: { Cumulative: ['Cedar Valley', "O'Brien Valley"] },
            excludedQuals: { Yearly: ['low', 'very low'] },
        }
        expect(parseDisplacement(JSON.stringify(state))).toEqual(state)
        expect(warn).not.toHaveBeenCalled()
    })

    it.each([
        ['a non-array basin list', JSON.stringify({ basins: { Cumulative: 5 } })],
        ['a non-array quality list', JSON.stringify({ excludedQuals: { Yearly: 'low' } })],
        ['a non-numeric year', JSON.stringify({ years: { Cumulative: 'abc' } })],
        ['a non-numeric threshold', JSON.stringify({ thresholds: { Cumulative: 'deep' } })],
        ['an infinite threshold', '{"thresholds":{"Cumulative":1e999}}'],
        ['a top-level array', JSON.stringify([1, 2])],
        ['unparseable JSON', '{not json'],
    ])('falls back to defaults and warns for %s', (_, raw) => {
        expect(parseDisplacement(raw)).toBeUndefined()
        expect(warn).toHaveBeenCalledOnce()
    })

    it('treats a missing param as defaults without warning', () => {
        expect(parseDisplacement(undefined)).toBeUndefined()
        expect(parseDisplacement('')).toBeUndefined()
        expect(warn).not.toHaveBeenCalled()
    })
})
