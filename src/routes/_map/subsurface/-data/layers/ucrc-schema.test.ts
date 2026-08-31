import { describe, it, expect } from 'vitest'
import { ucrcFilterSchema } from './ucrc-schema'
import { toMaplibreFilter, toCql, toPostgrestPredicates } from '@/lib/filter/generators'
import type { FilterState } from '@/lib/filter/types'

// Item 3: "core docs available filter yes/no/all". A boolean filter on the served
// has_attachments flag, mirroring the existing Has Core Photos filter. Synthetic wells below:
// three flagged as having docs, one without.
describe('UCRC "Has Core Docs" filter (item 3)', () => {
    it('is declared as a yes/no/all boolean on has_attachments', () => {
        const field = ucrcFilterSchema.fields.find(f => f.field === 'has_attachments')
        expect(field).toMatchObject({ kind: 'boolean', label: 'Has Core Docs' })
    })

    it('yes → constrains the map / CQL / PostgREST to wells that have docs', () => {
        const state: FilterState = { has_attachments: { kind: 'boolean', value: 'yes' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toEqual(['==', ['get', 'has_attachments'], true])
        expect(toCql(ucrcFilterSchema, state)).toBe("has_attachments = 'True'")
        expect(toPostgrestPredicates(ucrcFilterSchema, state)).toContain('has_attachments=eq.True')
    })

    it('no → constrains to wells without docs', () => {
        const state: FilterState = { has_attachments: { kind: 'boolean', value: 'no' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toEqual(['==', ['get', 'has_attachments'], false])
        expect(toCql(ucrcFilterSchema, state)).toBe("has_attachments = 'False'")
    })

    it('all → adds no core-docs predicate', () => {
        const state: FilterState = { has_attachments: { kind: 'boolean', value: 'all' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toBeNull()
        expect(toCql(ucrcFilterSchema, state)).toBe('')
    })

    it('the yes filter keeps exactly the doc-bearing test wells', () => {
        const state: FilterState = { has_attachments: { kind: 'boolean', value: 'yes' } }
        const expr = toMaplibreFilter(ucrcFilterSchema, state) as unknown as ['==', ['get', string], boolean]
        const field = expr[1][1]
        const want = expr[2]
        const wells: Record<string, unknown>[] = [
            { uwi: 'W-A', has_attachments: true },
            { uwi: 'W-B', has_attachments: true },
            { uwi: 'W-C', has_attachments: true },
            { uwi: 'W-NONE', has_attachments: false },
        ]
        const kept = wells.filter(w => w[field] === want).map(w => w.uwi)
        expect(kept).toEqual(['W-A', 'W-B', 'W-C'])
    })
})
