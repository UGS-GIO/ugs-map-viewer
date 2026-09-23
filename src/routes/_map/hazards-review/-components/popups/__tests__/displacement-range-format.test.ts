import { describe, it, expect } from 'vitest'
import { formatDisplacementRange } from '../displacement-layers'

// The new layer stores each contour band as a range (value_inches_min /
// value_inches_max) instead of one value. Popups show that range, unsigned,
// with the direction spelled out — matching the legend's magnitude convention.
describe('formatDisplacementRange', () => {
    it('renders a subsidence band as an unsigned magnitude range with direction', () => {
        expect(formatDisplacementRange(-5, -3, 'Cumulative')).toBe('3 – 5 in subsidence')
    })

    it('renders an uplift band as a range with direction', () => {
        expect(formatDisplacementRange(1, 3, 'Yearly')).toBe('1 – 3 in uplift')
    })

    it('uses per-year units for the Vertical Displacement Rate surface', () => {
        expect(formatDisplacementRange(-0.3, -0.15, 'Vertical Displacement Rate')).toBe(
            '0.15 – 0.3 in/year subsidence',
        )
    })

    it('collapses a single-value band to one magnitude', () => {
        expect(formatDisplacementRange(-5, -5, 'Cumulative')).toBe('5 in subsidence')
    })

    it('shows a signed range (no direction) for a band straddling zero', () => {
        expect(formatDisplacementRange(-1, 1, 'Cumulative')).toBe('-1 to 1 in')
    })

    it('accepts the stringified values that arrive from WMS GetFeatureInfo', () => {
        expect(formatDisplacementRange('-5', '-3', 'Cumulative')).toBe('3 – 5 in subsidence')
    })

    it('returns an em dash when either bound is missing', () => {
        expect(formatDisplacementRange(null, -3, 'Cumulative')).toBe('—')
        expect(formatDisplacementRange(-5, undefined, 'Cumulative')).toBe('—')
        expect(formatDisplacementRange('', '', 'Cumulative')).toBe('—')
    })
})
