import { describe, it, expect } from 'vitest'
import { isLatestYearLookupPending } from '../use-displacement-queries'

// The map's year clause resolves from a cheap latest-year lookup, with the 20k
// bulk pull as a fallback only when the cheap lookup errors. `isPending` gates the
// layer to a no-match clause while loading — so it MUST clear on every terminal
// state, or a lookup failure blanks the map forever (Clinton's #572-1). These
// cases pin that contract, especially the both-fail state that a naive
// `!cheap.data && !(cheap.isError && bulk.data)` left stuck pending.
const year = { data: { Cumulative: '2023' }, isError: false }
const loading = { data: undefined, isError: false }
const errored = { data: undefined, isError: true }

describe('isLatestYearLookupPending', () => {
    it('is pending while the cheap lookup is still in flight', () => {
        expect(isLatestYearLookupPending(loading, loading)).toBe(true)
    })

    it('settles once the cheap lookup returns data', () => {
        expect(isLatestYearLookupPending(year, loading)).toBe(false)
    })

    it('stays pending while the bulk fallback loads after a cheap error', () => {
        expect(isLatestYearLookupPending(errored, loading)).toBe(true)
    })

    it('settles when the bulk fallback returns data after a cheap error', () => {
        expect(isLatestYearLookupPending(errored, year)).toBe(false)
    })

    it('settles (not stuck pending) when BOTH the cheap lookup and bulk fallback fail', () => {
        // The regression: both-fail must resolve so the filter drops the year
        // clause (all-years visible) instead of gating the layer blank forever.
        expect(isLatestYearLookupPending(errored, errored)).toBe(false)
    })
})
