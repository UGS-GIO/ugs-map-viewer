import { createContext, useContext, useState, type ReactNode } from 'react'
import { DISPLACEMENT_LAYER_TYPES, type DisplacementLayerTitle, type DisplacementType } from './displacement-layers'

// Types whose features carry per-year value_inch and have year-driven analytics.
// Anything outside this set renders on the map but doesn't get a chart card or
// threshold input — `Vertical Displacement Rate` for example is a multi-year
// period summary, not a per-year quantity.
export const CHARTED_TYPES = ['Cumulative', 'Yearly'] as const
export type ChartedType = typeof CHARTED_TYPES[number]

// Per-type defaults match each SLD's "Zero" deadband boundary (currently 1.2 in
// for both charted types). Threshold is an additional |value_inch| floor on top
// of the SLD's own classification, so reviewers can tighten it further if
// needed without ever rendering features the SLD already buckets as "within
// uncertainty".
export const DEFAULT_THRESHOLDS_IN: Record<ChartedType, number> = {
    'Cumulative': 1.2,
    'Yearly': 1.2,
}

interface DisplacementFilterState {
    year: string  // 'all' or a 4-digit year
    thresholdsIn: Record<ChartedType, number>
    setYear: (y: string) => void
    setThresholdIn: (type: ChartedType, n: number) => void
}

const DisplacementFilterContext = createContext<DisplacementFilterState | null>(null)

export function DisplacementFilterProvider({ children }: { children: ReactNode }) {
    const [year, setYear] = useState<string>('all')
    const [thresholdsIn, setThresholdsIn] = useState<Record<ChartedType, number>>(DEFAULT_THRESHOLDS_IN)

    function setThresholdIn(type: ChartedType, n: number) {
        setThresholdsIn(prev => ({ ...prev, [type]: n }))
    }

    return (
        <DisplacementFilterContext.Provider value={{ year, thresholdsIn, setYear, setThresholdIn }}>
            {children}
        </DisplacementFilterContext.Provider>
    )
}

export function useDisplacementFilters(): DisplacementFilterState {
    const ctx = useContext(DisplacementFilterContext)
    if (!ctx) throw new Error('useDisplacementFilters must be used within DisplacementFilterProvider')
    return ctx
}

// Types whose features have null `year` (period-keyed) — Cumulative and Vertical
// Displacement Rate both summarize a multi-year period instead of a single year.
const TYPES_WITHOUT_YEAR: ReadonlySet<DisplacementType> = new Set(['Cumulative', 'Vertical Displacement Rate'])

function isChartedType(t: DisplacementType): t is ChartedType {
    return (CHARTED_TYPES as readonly string[]).includes(t)
}

/**
 * Translate filter state into per-layer cql_filter strings keyed by displacement
 * layer title. Combines with each layer's static `type='...'` cql via AND in
 * customLayerParameters — GeoServer concatenates these clauses. Only charted
 * types get a threshold clause (others have no threshold UI to tune it from).
 */
export function buildDisplacementLayerFilters(state: DisplacementFilterState): Record<string, string> {
    const out: Record<DisplacementLayerTitle, string> = {} as Record<DisplacementLayerTitle, string>
    for (const [title, typeValue] of Object.entries(DISPLACEMENT_LAYER_TYPES) as [DisplacementLayerTitle, DisplacementType][]) {
        const clauses: string[] = []
        if (state.year !== 'all' && !TYPES_WITHOUT_YEAR.has(typeValue)) {
            clauses.push(`year='${state.year}'`)
        }
        if (isChartedType(typeValue)) {
            const thresholdIn = state.thresholdsIn[typeValue]
            if (thresholdIn > 0) {
                clauses.push(`(value_inch >= ${thresholdIn} OR value_inch <= ${-thresholdIn})`)
            }
        }
        if (clauses.length > 0) out[title] = clauses.join(' AND ')
    }
    return out
}
