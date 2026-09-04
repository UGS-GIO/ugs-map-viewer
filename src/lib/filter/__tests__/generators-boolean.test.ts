import { describe, it, expect } from 'vitest'
import { toSqlPredicates, toMaplibreFilter, toPostgrestPredicates } from '../generators'
import type { FilterSchema, FilterState } from '../types'

const schema: FilterSchema = {
    fields: [{ kind: 'boolean', field: 'has_photos', label: 'Has Core Photos', trueValue: 'True', falseValue: 'False' }],
} as FilterSchema

const state = (value: 'yes' | 'no' | 'all'): FilterState => ({ has_photos: { kind: 'boolean', value } })

describe('boolean filter → SQL', () => {
    it('compares as a boolean, not against the PostgREST literals', () => {
        expect(toSqlPredicates(schema, state('yes'))[0]).toBe(`CAST("has_photos" AS BOOLEAN) = TRUE`)
        expect(toSqlPredicates(schema, state('no'))[0]).toBe(`CAST("has_photos" AS BOOLEAN) = FALSE`)
    })

    it('emits nothing for "all"', () => {
        expect(toSqlPredicates(schema, state('all'))).toEqual([])
    })

    it('leaves the maplibre and PostgREST branches alone', () => {
        expect(toMaplibreFilter(schema, state('yes'))).toEqual(['==', ['get', 'has_photos'], true])
        expect(toPostgrestPredicates(schema, state('yes'))).toEqual(['has_photos=eq.True'])
    })
})
