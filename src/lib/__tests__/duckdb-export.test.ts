import { describe, it, expect } from 'vitest'
import { joinedRelationSql } from '../duckdb-export'
import type { RelatedTable } from '@/lib/types/mapping-types'

const MAIN = "read_parquet('https://example.org/wells.parquet')"

const intervals: RelatedTable = {
    fieldLabel: 'Sample Types',
    fetchMode: 'parquet',
    url: 'https://example.org/intervals.parquet',
    matchingField: 'uwi',
    targetField: 'uwi',
    sortBy: 'top_ft',
    combineIntoExport: true,
    displayFields: [
        { field: 'sample_type', label: 'Type' },
        { field: 'top_ft', label: 'Top (ft)' },
        { field: 'notes_public', label: 'Notes' },
    ],
}

describe('joinedRelationSql', () => {
    it('leaves the main relation alone when nothing is combined', () => {
        expect(joinedRelationSql(MAIN, ['uwi'], [])).toBe(MAIN)
    })

    it('left joins on the configured keys so wells without rows survive', () => {
        const sql = joinedRelationSql(MAIN, ['uwi'], [intervals])
        expect(sql).toContain(`LEFT JOIN read_parquet('https://example.org/intervals.parquet') AS r0`)
        expect(sql).toContain('ON m."uwi" = r0."uwi"')
    })

    it('carries each display field through under its own name', () => {
        const sql = joinedRelationSql(MAIN, ['uwi'], [intervals])
        expect(sql).toContain('r0."sample_type" AS "sample_type"')
        expect(sql).toContain('r0."top_ft" AS "top_ft"')
    })

    it('prefixes a field whose name the layer already uses', () => {
        const sql = joinedRelationSql(MAIN, ['uwi', 'notes_public'], [intervals])
        expect(sql).toContain('r0."notes_public" AS "sample_types_notes_public"')
        expect(sql).not.toContain('r0."notes_public" AS "notes_public"')
    })

    it('groups rows by join key, then by the table\'s sort key', () => {
        expect(joinedRelationSql(MAIN, ['uwi'], [intervals])).toContain('ORDER BY m."uwi", r0."top_ft"')
    })

    it('escapes quotes in a related url', () => {
        const sneaky: RelatedTable = { ...intervals, url: "https://example.org/a'b.parquet" }
        expect(joinedRelationSql(MAIN, ['uwi'], [sneaky])).toContain("a''b.parquet")
    })
})
