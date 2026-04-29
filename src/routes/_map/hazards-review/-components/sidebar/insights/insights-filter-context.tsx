import { createContext, useContext, useState, type ReactNode } from 'react'

export const DISPLACEMENT_TYPES = ['Cumulative', 'Yearly', 'Velocity', 'Annual amplitude'] as const
export type DisplacementType = typeof DISPLACEMENT_TYPES[number]

interface InsightsFilterState {
    type: DisplacementType
    year: string  // 'all' or a 4-digit year
    basin: string // 'all' or a location label
    thresholdFt: number
    setType: (t: DisplacementType) => void
    setYear: (y: string) => void
    setBasin: (b: string) => void
    setThresholdFt: (n: number) => void
}

const InsightsFilterContext = createContext<InsightsFilterState | null>(null)

export function InsightsFilterProvider({ children }: { children: ReactNode }) {
    const [type, setType] = useState<DisplacementType>('Velocity')
    const [year, setYear] = useState<string>('all')
    const [basin, setBasin] = useState<string>('all')
    const [thresholdFt, setThresholdFt] = useState<number>(0.1)

    return (
        <InsightsFilterContext.Provider value={{ type, year, basin, thresholdFt, setType, setYear, setBasin, setThresholdFt }}>
            {children}
        </InsightsFilterContext.Provider>
    )
}

export function useInsightsFilters(): InsightsFilterState {
    const ctx = useContext(InsightsFilterContext)
    if (!ctx) throw new Error('useInsightsFilters must be used within InsightsFilterProvider')
    return ctx
}

/**
 * Translate insights filter state into per-layer cql_filter strings keyed by the
 * displacement layer title. Returned object is fed to GenericMapContainer's
 * `layerFilters` prop. Returns empty object when no scope filters are set so all
 * 4 displacement layers render unfiltered.
 */
export function buildDisplacementLayerFilters(state: InsightsFilterState): Record<string, string> {
    const clauses: string[] = []
    if (state.year !== 'all') clauses.push(`year='${state.year}'`)
    if (state.basin !== 'all') clauses.push(`location='${state.basin.replace(/'/g, "''")}'`)
    if (clauses.length === 0) return {}
    const cql = clauses.join(' AND ')
    return {
        'Displacement Contours - Cumulative': cql,
        'Displacement Contours - Yearly': cql,
        'Displacement Contours - Velocity': cql,
        'Displacement Contours - Annual Amplitude': cql,
        'Displacement Contours - Cumulative: Review': cql,
        'Displacement Contours - Yearly: Review': cql,
        'Displacement Contours - Velocity: Review': cql,
        'Displacement Contours - Annual Amplitude: Review': cql,
    }
}
