import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import { z } from 'zod'

export type YesNoAll = 'yes' | 'no' | 'all'

export interface WellFilterState {
    core: YesNoAll
    las: YesNoAll
    formations: string[]
    formation_operator?: 'and'
}

export const EMPTY_WELL_FILTER: WellFilterState = {
    core: 'all',
    las: 'all',
    formations: [],
    formation_operator: undefined,
}

const VALID_COL = /^[a-zA-Z0-9_]+$/

const yesNoAllSchema = z.enum(['yes', 'no', 'all'])
const wellFilterSchema = z.object({
    core: yesNoAllSchema.catch('all').default('all'),
    las: yesNoAllSchema.catch('all').default('all'),
    formations: z.array(z.unknown()).catch([]).default([]).transform(arr =>
        arr.filter((f): f is string => typeof f === 'string' && VALID_COL.test(f)),
    ),
    formation_operator: z.literal('and').optional().catch(undefined),
})

const parseCqlBoolean = (raw: string, field: string): YesNoAll => {
    if (new RegExp(`\\b${field}\\s*=\\s*['"]?true['"]?(?=[\\s)]|$)`, 'i').test(raw)) return 'yes'
    if (new RegExp(`\\b${field}\\s*=\\s*['"]?false['"]?(?=[\\s)]|$)`, 'i').test(raw)) return 'no'
    return 'all'
}

/** Serialize well filter state into a compact JSON string for URL `filters[Wells Database]`, or '' when empty. */
export function serializeWellFilter(state: WellFilterState): string {
    const out: Record<string, unknown> = {}
    if (state.core !== 'all') out.core = state.core
    if (state.las !== 'all') out.las = state.las
    const formations = state.formations.filter(f => VALID_COL.test(f))
    if (formations.length > 0) {
        out.formations = formations
        if (formations.length > 1 && state.formation_operator === 'and') {
            out.formation_operator = 'and'
        }
    }
    return Object.keys(out).length > 0 ? JSON.stringify(out) : ''
}

/**
 * Parse URL filter value back into {@link WellFilterState}. Accepts the JSON format
 * emitted by {@link serializeWellFilter} as well as legacy CQL bookmarks.
 */
export function parseWellFilter(raw: string | null | undefined): WellFilterState {
    const trimmed = raw?.trim()
    if (!trimmed) return EMPTY_WELL_FILTER

    if (trimmed.startsWith('{')) {
        try {
            const validated = wellFilterSchema.safeParse(JSON.parse(trimmed))
            if (!validated.success) return EMPTY_WELL_FILTER
            const { core, las, formations, formation_operator } = validated.data
            return {
                core,
                las,
                formations,
                formation_operator: formations.length > 1 ? formation_operator : undefined,
            }
        } catch {
            return EMPTY_WELL_FILTER
        }
    }

    // One-way fallback for legacy CQL bookmarks (e.g. `hascore = 'True' AND (fm_x IS NOT NULL)`).
    const core = parseCqlBoolean(trimmed, 'hascore')
    const las = parseCqlBoolean(trimmed, 'has_las')
    const formationMatches = trimmed.match(/\b([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL/gi) || []
    const formations = formationMatches.map(m => m.split(/\s+/)[0]).filter(f => VALID_COL.test(f))
    const formation_operator = formations.length > 1 &&
        /IS\s+NOT\s+NULL\s*\)?\s*AND\s*\(?\s*[a-zA-Z0-9_]+\s+IS\s+NOT\s+NULL/i.test(trimmed)
        ? 'and'
        : undefined
    return { core, las, formations, formation_operator }
}

/** Build a MapLibre {@link FilterSpecification} directly from structured well filter state. */
export function buildWellsMaplibreFilter(state: WellFilterState): FilterSpecification | null {
    const clauses: ExpressionSpecification[] = []

    if (state.core === 'yes') clauses.push(['==', ['get', 'hascore'], 'True'])
    if (state.core === 'no') clauses.push(['==', ['get', 'hascore'], 'False'])

    if (state.las === 'yes') clauses.push(['==', ['get', 'has_las'], true])
    if (state.las === 'no') clauses.push(['==', ['get', 'has_las'], false])

    const formations = state.formations.filter(f => VALID_COL.test(f))
    if (formations.length > 0) {
        const presence: ExpressionSpecification[] = formations.map(col => [
            'all',
            ['has', col],
            ['!=', ['get', col], null],
        ])
        if (presence.length === 1) {
            clauses.push(presence[0])
        } else {
            const op = state.formation_operator === 'and' ? 'all' : 'any'
            clauses.push([op, ...presence] as ExpressionSpecification)
        }
    }

    if (clauses.length === 0) return null
    return (clauses.length === 1 ? clauses[0] : ['all', ...clauses]) as FilterSpecification
}
