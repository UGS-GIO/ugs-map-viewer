import { describe, it, expect } from 'vitest'
import { getPopulatedBinBoundaries } from '../displacement-thresholds'
import type { SldBin } from '../displacement-sld-legend'

const bin = (min: number, max: number, isZero = false): SldBin => ({
    name: '', title: '', min, max, color: '#000', isZero, include: [], exclude: [],
})

// Cumulative-shaped SLD mirroring hazards_displacement_insar_cumulative:
// deadband [-1, 1]; subsidence classes run deeper (to <-13) than uplift (to >9),
// so the magnitude edges reduce to {1,3,5,7,9,11,13} (11/13 come from the deeper
// negative side).
const cumulativeBins: SldBin[] = [
    bin(-Infinity, -13), bin(-13, -11), bin(-11, -9), bin(-9, -7),
    bin(-7, -5), bin(-5, -3), bin(-3, -1),
    bin(-1, 1, true),
    bin(1, 3), bin(3, 5), bin(5, 7), bin(7, 9), bin(9, Infinity),
]

describe('getPopulatedBinBoundaries', () => {
    it('drops the empty 1-3 band for Cumulative so "1 in" no longer duplicates "3 in"', () => {
        // Real Cumulative contours are odd inches and |1| is the deadband, so no
        // feature falls in [1, 3) — the 1 edge is redundant with 3.
        const magnitudes = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]
        const opts = getPopulatedBinBoundaries(cumulativeBins, magnitudes)
        expect(opts).not.toContain(1)
        expect(opts[0]).toBe(3)
    })

    it('keeps the 1 edge when a real feature sits in the 1-3 band above the deadband', () => {
        // A |2| reading makes [1, 3) non-empty, so "1 in" now filters differently
        // from "3 in" and is offered.
        const magnitudes = [1, 2, 3, 5, 7, 9]
        const opts = getPopulatedBinBoundaries(cumulativeBins, magnitudes)
        expect(opts[0]).toBe(1)
        expect(opts).toContain(3)
    })

    it('drops the open top edge when no feature reaches it', () => {
        // Only |3| and |5| present, so the 7/9/11/13 edges' bands are empty.
        expect(getPopulatedBinBoundaries(cumulativeBins, [1, 3, 5])).toEqual([3, 5])
    })

    it('offers nothing while feature magnitudes are still loading', () => {
        expect(getPopulatedBinBoundaries(cumulativeBins, [])).toEqual([])
    })

    it('offers every populated edge when the style has no deadband (zeroBound 0)', () => {
        const noDeadband: SldBin[] = [bin(1, 3), bin(3, 5), bin(5, Infinity)]
        expect(getPopulatedBinBoundaries(noDeadband, [1, 3, 5])).toEqual([1, 3, 5])
    })
})
