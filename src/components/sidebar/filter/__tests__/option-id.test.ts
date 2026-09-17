import { describe, it, expect } from 'vitest'
import { optionId } from '../layer-filter-panel'

describe('optionId', () => {
    it('replaces the characters an id may not carry', () => {
        expect(optionId('Whole Core')).toBe('Whole_Core')
        expect(optionId('Oil & Gas')).toBe('Oil_Gas')
        expect(optionId('Core Chips (partial)')).toBe('Core_Chips_partial_')
    })

    it('is stable for a label regardless of its position in the list', () => {
        expect(optionId('Cuttings')).toBe(optionId('Cuttings'))
    })

    it('keeps distinct labels distinct', () => {
        expect(optionId('Core Samples')).not.toBe(optionId('Core Chips'))
    })
})
