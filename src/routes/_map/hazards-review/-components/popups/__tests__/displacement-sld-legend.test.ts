import { describe, it, expect } from 'vitest'
import { binMatches, magnitudeLabel, parseRuleFilter, type SldBin } from '../displacement-sld-legend'

const DEADBAND = "NOT (value_inches >= '-1' AND value_inches <= '1')"

const bin = (include: SldBin['include'], exclude: SldBin['exclude']): SldBin => ({
    name: 'x', title: 'x', min: -Infinity, max: Infinity, color: '#000', isZero: false, include, exclude,
})

describe('parseRuleFilter', () => {
    it('keeps the NOT-deadband comparisons instead of dropping them', () => {
        const { include, exclude } = parseRuleFilter(`[value_inches >= '1' AND value_inches < '3' AND ${DEADBAND}]`)
        expect(include).toEqual([{ op: '>=', value: 1 }, { op: '<', value: 3 }])
        expect(exclude).toEqual([{ op: '>=', value: -1 }, { op: '<=', value: 1 }])
    })

    it('derives min/max for ordering', () => {
        const { min, max } = parseRuleFilter(`[value_inches >= '-3' AND value_inches < '-1' AND ${DEADBAND}]`)
        expect({ min, max }).toEqual({ min: -3, max: -1 })
    })

    it('leaves open-ended bounds infinite', () => {
        expect(parseRuleFilter(`[value_inches < '-13' AND ${DEADBAND}]`).min).toBe(-Infinity)
        expect(parseRuleFilter(`[value_inches >= '9' AND ${DEADBAND}]`).max).toBe(Infinity)
    })
})

describe('binMatches', () => {
    // Contour values are whole inches, so they land exactly on the shared edge
    // between a band and the deadband — the case that decides which one wins.
    const upper = bin([{ op: '>=', value: 1 }, { op: '<', value: 3 }], [{ op: '>=', value: -1 }, { op: '<=', value: 1 }])
    const lower = bin([{ op: '>=', value: -3 }, { op: '<', value: -1 }], [{ op: '>=', value: -1 }, { op: '<=', value: 1 }])
    const zero = bin([{ op: '>=', value: -1 }, { op: '<=', value: 1 }], [])

    it('sends deadband-edge values to the deadband, not the coloured band', () => {
        expect(binMatches(upper, 1)).toBe(false)
        expect(binMatches(lower, -1)).toBe(false)
        expect(binMatches(zero, 1)).toBe(true)
        expect(binMatches(zero, -1)).toBe(true)
    })

    it('matches values inside a band and honours the half-open upper bound', () => {
        expect(binMatches(upper, 2)).toBe(true)
        expect(binMatches(upper, 3)).toBe(false)
    })

    it('matches nothing when the filter did not parse', () => {
        expect(binMatches(bin([], []), 5)).toBe(false)
    })
})

describe('magnitudeLabel', () => {
    const b = (min: number, max: number): SldBin => ({
        name: 'x', title: 'x', min, max, color: '#000', isZero: false, include: [], exclude: [],
    })

    it('renders a subsidence bin as an unsigned range (no "-5 – -3")', () => {
        expect(magnitudeLabel(b(-5, -3))).toBe('3 – 5 in')
    })

    it('renders an uplift bin as a range', () => {
        expect(magnitudeLabel(b(3, 5))).toBe('3 – 5 in')
    })

    it('renders an open tail with a > prefix, either sign', () => {
        expect(magnitudeLabel(b(9, Infinity))).toBe('> 9 in')
        expect(magnitudeLabel(b(-Infinity, -13))).toBe('> 13 in')
    })
})
