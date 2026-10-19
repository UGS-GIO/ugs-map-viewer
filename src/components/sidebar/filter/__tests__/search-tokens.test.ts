import { describe, it, expect } from 'vitest'
import { searchTokens } from '../search-fetchers'

describe('searchTokens', () => {
    // Tokens are ANDed, so a word matching no column wipes the result set.
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

describe('postgREST multi-token search', () => {
    // Must match all tokens in any order across columns, not one contiguous run.
    it('ANDs tokens and ORs the target fields', async () => {
        const { buildPostgrestSearchParams } = await import('../search-fetchers')
        const params = buildPostgrestSearchParams(['api', 'wellname'], 'federal 1')
        expect(params.get('and')).toBe('(or(api.ilike."*federal*",wellname.ilike."*federal*"),or(api.ilike."*1*",wellname.ilike."*1*"))')
        expect(params.get('or')).toBeNull()
    })

    it('keeps the simple OR for a single token', async () => {
        const { buildPostgrestSearchParams } = await import('../search-fetchers')
        const params = buildPostgrestSearchParams(['api', 'wellname'], 'federal')
        expect(params.get('or')).toBe('(api.ilike."*federal*",wellname.ilike."*federal*")')
    })

    it('drops label words here too', async () => {
        const { buildPostgrestSearchParams } = await import('../search-fetchers')
        const params = buildPostgrestSearchParams(['label'], 'Township 43S')
        expect(params.get('label')).toBe('ilike."*43S*"')
    })
})
