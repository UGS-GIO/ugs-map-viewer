import { describe, it, expect } from 'vitest'
import { bandAtLeastCql, bandShallowMagnitude, getPopulatedBinBoundaries } from '../displacement-thresholds'
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

describe('bandShallowMagnitude', () => {
    it('uses the edge nearer zero for subsidence and uplift bands', () => {
        expect(bandShallowMagnitude(-3, -1)).toBe(1)
        expect(bandShallowMagnitude(-25, -23)).toBe(23)
        expect(bandShallowMagnitude(1, 3)).toBe(1)
    })

    it('gives 0 for a band that straddles zero (within error)', () => {
        expect(bandShallowMagnitude(-1, 1)).toBe(0)
        expect(bandShallowMagnitude(-0.3, 0)).toBe(0)
        expect(bandShallowMagnitude(0, 1)).toBe(0)
    })
})

describe('bandAtLeastCql', () => {
    it('matches bands whose shallow edge reaches the threshold on either side', () => {
        expect(bandAtLeastCql(3)).toBe('(value_inches_max <= -3 OR value_inches_min >= 3)')
    })
})

describe('getPopulatedBinBoundaries', () => {
    // Shallow-edge magnitudes from live Cumulative bands: 0 is the [-1, 1]
    // within-error band, 1 is the 1-3 in bands on either side, and so on.
    it('offers 1 in, as the default, when the 1-3 in band has data', () => {
        const magnitudes = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]
        const opts = getPopulatedBinBoundaries(cumulativeBins, magnitudes)
        expect(opts[0]).toBe(1)
        expect(opts).toContain(3)
    })

    it('skips an edge no band starts in, so two options never filter the same', () => {
        const opts = getPopulatedBinBoundaries(cumulativeBins, [0, 3, 5, 7])
        expect(opts).not.toContain(1)
        expect(opts[0]).toBe(3)
    })

    it('drops the open top edge when no band reaches it', () => {
        expect(getPopulatedBinBoundaries(cumulativeBins, [0, 1, 3])).toEqual([1, 3])
    })

    it('offers nothing while feature magnitudes are still loading', () => {
        expect(getPopulatedBinBoundaries(cumulativeBins, [])).toEqual([])
    })

    it('offers every populated edge when the style has no deadband (zeroBound 0)', () => {
        const noDeadband: SldBin[] = [bin(1, 3), bin(3, 5), bin(5, Infinity)]
        expect(getPopulatedBinBoundaries(noDeadband, [1, 3, 5])).toEqual([1, 3, 5])
    })
})
