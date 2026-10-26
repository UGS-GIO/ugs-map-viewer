import { describe, it, expect } from 'vitest'
import { legendLookups } from '@/lib/legend/legend-lookups'

describe('legendLookups', () => {
    it('colours a flat entry by its value and shows its label', () => {
        const { colorFor, labelFor } = legendLookups([{ label: 'Coal', value: 'coal', color: '#000000' }])
        expect(colorFor('coal')).toBe('#000000')
        expect(labelFor('coal')).toBe('Coal')
    })

    it('falls back to the label as the value when none is given', () => {
        const { colorFor, labelFor } = legendLookups([{ label: 'QT', color: '#fef989' }])
        expect(colorFor('QT')).toBe('#fef989')
        expect(labelFor('QT')).toBe('QT')
    })

    it('uses grouped items\' own shades and labels', () => {
        const { colorFor, labelFor } = legendLookups([{
            label: 'Core', color: '#111111',
            values: [{ value: 'CORESAMPLES', color: '#222222', label: 'Core Samples' }],
        }])
        expect(colorFor('CORESAMPLES')).toBe('#222222')
        expect(labelFor('CORESAMPLES')).toBe('Core Samples')
    })

    it('greys out values the legend does not list', () => {
        expect(legendLookups([]).colorFor('unknown')).toBe('#bdbdbd')
    })
})
