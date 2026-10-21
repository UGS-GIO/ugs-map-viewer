import { describe, expect, it } from 'vitest'
import { CONFIRMED_LOW_KEY, dataQualityCql, passesDataQuality } from '../displacement-quality'

const high = { data_qual: 'high', independent_confirmation: false }
const medium = { data_qual: 'medium', independent_confirmation: true }
const confirmedLow = { data_qual: 'low', independent_confirmation: true }
const confirmedVeryLow = { data_qual: 'very low', independent_confirmation: true }
const unconfirmedLow = { data_qual: 'low', independent_confirmation: false }
const nullConfirmationLow = { data_qual: 'very low', independent_confirmation: null }

describe('passesDataQuality', () => {
    it('default view keeps high, medium and confirmed low, drops unconfirmed low', () => {
        const excluded = new Set(['low', 'very low', 'unknown'])
        expect(passesDataQuality(high, excluded)).toBe(true)
        expect(passesDataQuality(medium, excluded)).toBe(true)
        expect(passesDataQuality(confirmedLow, excluded)).toBe(true)
        expect(passesDataQuality(confirmedVeryLow, excluded)).toBe(true)
        expect(passesDataQuality(unconfirmedLow, excluded)).toBe(false)
        expect(passesDataQuality(nullConfirmationLow, excluded)).toBe(false)
    })

    it('hiding confirmed low drops only the confirmed low tiers', () => {
        const excluded = new Set([CONFIRMED_LOW_KEY])
        expect(passesDataQuality(confirmedLow, excluded)).toBe(false)
        expect(passesDataQuality(unconfirmedLow, excluded)).toBe(true)
        expect(passesDataQuality(medium, excluded)).toBe(true)
    })

    it('keeps a feature with no data_qual, like the CQL does', () => {
        expect(passesDataQuality({ data_qual: null }, new Set(['low', CONFIRMED_LOW_KEY]))).toBe(true)
    })

    it('excluding medium hides confirmed medium too (confirmation only matters for low tiers)', () => {
        expect(passesDataQuality(medium, new Set(['medium']))).toBe(false)
    })
})

describe('dataQualityCql', () => {
    it('returns null when nothing is excluded', () => {
        expect(dataQualityCql(new Set())).toBeNull()
    })

    it('keeps confirmed low when only categories are excluded', () => {
        expect(dataQualityCql(new Set(['low', 'very low']))).toBe(
            "((independent_confirmation = true AND data_qual IN ('low', 'very low')) OR (data_qual IS NULL OR data_qual NOT IN ('low', 'very low')))",
        )
    })

    it('drops confirmed low, treating a null confirmation as unconfirmed', () => {
        expect(dataQualityCql(new Set([CONFIRMED_LOW_KEY]))).toBe(
            "(data_qual IS NULL OR data_qual NOT IN ('low', 'very low') OR independent_confirmation = false OR independent_confirmation IS NULL)",
        )
    })

    it('combines the confirmed-low toggle with excluded categories', () => {
        expect(dataQualityCql(new Set([CONFIRMED_LOW_KEY, 'high']))).toBe(
            "((data_qual IS NULL OR data_qual NOT IN ('low', 'very low') OR independent_confirmation = false OR independent_confirmation IS NULL) AND (data_qual IS NULL OR data_qual NOT IN ('high')))",
        )
    })
})
