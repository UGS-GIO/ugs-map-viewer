import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'

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

const isYesNoAll = (v: unknown): v is YesNoAll => v === 'yes' || v === 'no' || v === 'all'
const VALID_COL = /^[a-zA-Z0-9_]+$/

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
    if (!raw) return EMPTY_WELL_FILTER

    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const core = isYesNoAll(parsed.core) ? parsed.core : 'all'
            const las = isYesNoAll(parsed.las) ? parsed.las : 'all'
            const formations = Array.isArray(parsed.formations)
                ? parsed.formations.filter((f): f is string => typeof f === 'string' && VALID_COL.test(f))
                : []
            const formation_operator = formations.length > 1 && parsed.formation_operator === 'and' ? 'and' : undefined
            return { core, las, formations, formation_operator }
        } catch {
            return EMPTY_WELL_FILTER
        }
    }

    // One-way fallback for legacy CQL bookmarks (e.g. `hascore = 'True' AND (fm_x IS NOT NULL)`).
    const core: YesNoAll = raw.includes(`hascore = 'True'`)
        ? 'yes'
        : raw.includes(`hascore = 'False'`)
            ? 'no'
            : 'all'
    const las: YesNoAll = raw.includes(`has_las = 'True'`)
        ? 'yes'
        : raw.includes(`has_las = 'False'`)
            ? 'no'
            : 'all'
    const formationMatches = raw.match(/\b([a-zA-Z0-9_]+)\s+IS NOT NULL/gi) || []
    const formations = formationMatches.map(m => m.split(/\s+/)[0]).filter(f => VALID_COL.test(f))
    const formation_operator = formations.length > 1 &&
        /IS\s+NOT\s+NULL\s*\)?\s*AND\s*\(?\s*[a-zA-Z0-9_]+\s+IS\s+NOT\s+NULL/i.test(raw)
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
