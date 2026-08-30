import { describe, it, expect } from 'vitest'
import { ucrcFilterSchema } from './ucrc-schema'
import { toMaplibreFilter, toCql, toPostgrestPredicates } from '@/lib/filter/generators'
import type { FilterState } from '@/lib/filter/types'

// Item 3: "core docs available filter yes/no/all". A boolean filter on the served
// has_core_docs flag, mirroring the existing Has Core Photos filter. Test data below are the
// three real wells that #209 will flag as having docs, plus one without.
describe('UCRC "Has Core Docs" filter (item 3)', () => {
    it('is declared as a yes/no/all boolean on has_core_docs', () => {
        const field = ucrcFilterSchema.fields.find(f => f.field === 'has_core_docs')
        expect(field).toMatchObject({ kind: 'boolean', label: 'Has Core Docs' })
    })

    it('yes → constrains the map / CQL / PostgREST to wells that have docs', () => {
        const state: FilterState = { has_core_docs: { kind: 'boolean', value: 'yes' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toEqual(['==', ['get', 'has_core_docs'], true])
        expect(toCql(ucrcFilterSchema, state)).toBe("has_core_docs = 'True'")
        expect(toPostgrestPredicates(ucrcFilterSchema, state)).toContain('has_core_docs=eq.True')
    })

    it('no → constrains to wells without docs', () => {
        const state: FilterState = { has_core_docs: { kind: 'boolean', value: 'no' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toEqual(['==', ['get', 'has_core_docs'], false])
        expect(toCql(ucrcFilterSchema, state)).toBe("has_core_docs = 'False'")
    })

    it('all → adds no core-docs predicate', () => {
        const state: FilterState = { has_core_docs: { kind: 'boolean', value: 'all' } }
        expect(toMaplibreFilter(ucrcFilterSchema, state)).toBeNull()
        expect(toCql(ucrcFilterSchema, state)).toBe('')
    })

    it('the yes filter keeps exactly the doc-bearing test wells', () => {
        const state: FilterState = { has_core_docs: { kind: 'boolean', value: 'yes' } }
        const expr = toMaplibreFilter(ucrcFilterSchema, state) as unknown as ['==', ['get', string], boolean]
        const field = expr[1][1]
        const want = expr[2]
        const wells: Record<string, unknown>[] = [
            { uwi: '4300750099B000', has_core_docs: true },   // MUDDY 08-18-1
            { uwi: '0510370000S000', has_core_docs: true },   // PR-15-7C
            { uwi: '05103070430000', has_core_docs: true },   // E. Rector 8X
            { uwi: '9999999999999', has_core_docs: false },   // no docs
        ]
        const kept = wells.filter(w => w[field] === want).map(w => w.uwi)
        expect(kept).toEqual(['4300750099B000', '0510370000S000', '05103070430000'])
    })
})
