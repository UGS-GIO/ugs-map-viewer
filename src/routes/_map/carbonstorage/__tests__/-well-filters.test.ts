import { describe, it, expect } from 'vitest'
import {
    buildWellsMaplibreFilter,
    EMPTY_WELL_FILTER,
    parseWellFilter,
    serializeWellFilter,
} from '../-data/well-filters'

describe('well-filters', () => {
    it('round-trips structured filter state through JSON', () => {
        const state = { core: 'yes' as const, las: 'no' as const, formations: ['fm_navajo', 'fm_wingate'], formation_operator: 'and' as const }
        const raw = serializeWellFilter(state)
        expect(raw.startsWith('{')).toBe(true)
        expect(parseWellFilter(raw)).toEqual(state)
    })

    it('returns empty string and null filter for default state', () => {
        expect(serializeWellFilter(EMPTY_WELL_FILTER)).toBe('')
        expect(buildWellsMaplibreFilter(EMPTY_WELL_FILTER)).toBeNull()
    })

    it('builds MapLibre filter directly from structured state', () => {
        expect(buildWellsMaplibreFilter({
            core: 'yes',
            las: 'yes',
            formations: ['fm_navajo', 'fm_wingate'],
            formation_operator: undefined,
        })).toEqual([
            'all',
            ['==', ['get', 'hascore'], 'True'],
            ['==', ['get', 'has_las'], true],
            ['any',
                ['all', ['has', 'fm_navajo'], ['!=', ['get', 'fm_navajo'], null]],
                ['all', ['has', 'fm_wingate'], ['!=', ['get', 'fm_wingate'], null]],
            ],
        ])
    })

    it('reads legacy CQL bookmarks into structured state', () => {
        expect(parseWellFilter(`hascore = 'True' AND has_las = 'False' AND (fm_a IS NOT NULL AND fm_b IS NOT NULL)`)).toEqual({
            core: 'yes',
            las: 'no',
            formations: ['fm_a', 'fm_b'],
            formation_operator: 'and',
        })
        expect(parseWellFilter(`  hascore=TRUE and has_las = false  `)).toEqual({
            core: 'yes',
            las: 'no',
            formations: [],
            formation_operator: undefined,
        })
    })

    it('trims whitespace before JSON parsing and handles malformed inputs safely', () => {
        expect(parseWellFilter('  {"core":"yes","formations":["fm_ok","bad col"]}  ')).toEqual({
            core: 'yes',
            las: 'all',
            formations: ['fm_ok'],
            formation_operator: undefined,
        })
        expect(parseWellFilter('  {not-json')).toEqual(EMPTY_WELL_FILTER)
    })
})
