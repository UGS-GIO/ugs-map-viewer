import { describe, it, expect } from 'vitest'
import { optionId } from '../layer-filter-panel'

describe('optionId', () => {
    it('replaces the characters an id may not carry', () => {
        expect(optionId('Whole Core')).toBe('Whole_0020Core')
        expect(optionId('Core Chips (partial)')).toBe('Core_0020Chips_0020_0028partial_0029')
    })

    it('keeps labels apart that differ only in punctuation', () => {
        expect(optionId('Oil Gas')).not.toBe(optionId('Oil & Gas'))
    })

    it('is stable for a label regardless of its position in the list', () => {
        expect(optionId('Cuttings')).toBe(optionId('Cuttings'))
    })

    it('keeps distinct labels distinct', () => {
        expect(optionId('Core Samples')).not.toBe(optionId('Core Chips'))
    })
})
