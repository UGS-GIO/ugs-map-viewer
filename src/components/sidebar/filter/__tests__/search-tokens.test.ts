import { describe, it, expect } from 'vitest'
import { searchTokens } from '../search-fetchers'

describe('searchTokens', () => {
    // Tokens are ANDed in the WHERE clause, so a word that matches no column — "Sec" —
    // wipes out the whole result set. These are the forms people actually type.
    it('drops label words that no column holds', () => {
        expect(searchTokens('T43S R11W Sec 31')).toEqual(['T43S', 'R11W', '31'])
        expect(searchTokens('T43S R11W Section 31')).toEqual(['T43S', 'R11W', '31'])
        expect(searchTokens('Township 43S Range 11W')).toEqual(['43S', '11W'])
    })

    it('leaves real values alone', () => {
        expect(searchTokens('43S 11W 31')).toEqual(['43S', '11W', '31'])
        expect(searchTokens('  T21S   R5E  ')).toEqual(['T21S', 'R5E'])
    })

    it('returns nothing for an empty or label-only term', () => {
        expect(searchTokens('')).toEqual([])
        expect(searchTokens('   ')).toEqual([])
        expect(searchTokens('Sec')).toEqual([])
    })
})
