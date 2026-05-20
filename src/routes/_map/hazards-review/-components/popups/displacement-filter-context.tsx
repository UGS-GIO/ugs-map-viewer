import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DISPLACEMENT_LAYER_TYPES, getStyleNameForType, type DisplacementLayerTitle, type DisplacementType } from './displacement-layers'
import { fetchDisplacementSldBins, type SldBin } from './displacement-sld-legend'

// Types whose features carry per-year value_inch and have year-driven analytics.
// Anything outside this set renders on the map but doesn't get a chart card or
// threshold input — `Vertical Displacement Rate` for example is a multi-year
// period summary, not a per-year quantity.
export const CHARTED_TYPES = ['Cumulative', 'Yearly'] as const
export type ChartedType = typeof CHARTED_TYPES[number]

// Fallback used only when the SLD's "Zero" deadband can't be resolved (network
// failure, schema drift, etc.). Real defaults come from the SLD at runtime.
const FALLBACK_THRESHOLD_IN = 1.2

// `null` means "auto — use the SLD's Zero deadband as the effective threshold."
// A numeric value means the user explicitly tightened or loosened it.
type ThresholdState = number | null

interface DisplacementFilterState {
    year: string  // 'all' or a 4-digit year
    thresholdsIn: Record<ChartedType, ThresholdState>
    /** Selected basin locations per displacement type. Empty set = no basin filter (all basins). */
    basinsByType: Record<DisplacementType, ReadonlySet<string>>
    setYear: (y: string) => void
    setThresholdIn: (type: ChartedType, n: ThresholdState) => void
    addBasin: (type: DisplacementType, location: string) => void
    removeBasin: (type: DisplacementType, location: string) => void
    clearBasins: (type: DisplacementType) => void
}

const DisplacementFilterContext = createContext<DisplacementFilterState | null>(null)

export function DisplacementFilterProvider({ children }: { children: ReactNode }) {
    const [year, setYear] = useState<string>('all')
    const [thresholdsIn, setThresholdsIn] = useState<Record<ChartedType, ThresholdState>>({
        'Cumulative': null,
        'Yearly': null,
    })
    const [basinsByType, setBasinsByType] = useState<Record<DisplacementType, ReadonlySet<string>>>({
        'Cumulative': new Set(),
        'Yearly': new Set(),
        'Vertical Displacement Rate': new Set(),
    })

    function setThresholdIn(type: ChartedType, n: ThresholdState) {
        setThresholdsIn(prev => ({ ...prev, [type]: n }))
    }

    function addBasin(type: DisplacementType, location: string) {
        setBasinsByType(prev => {
            const next = new Set(prev[type])
            next.add(location)
            return { ...prev, [type]: next }
        })
    }

    function removeBasin(type: DisplacementType, location: string) {
        setBasinsByType(prev => {
            const next = new Set(prev[type])
            next.delete(location)
            return { ...prev, [type]: next }
        })
    }

    function clearBasins(type: DisplacementType) {
        setBasinsByType(prev => ({ ...prev, [type]: new Set() }))
    }

    return (
        <DisplacementFilterContext.Provider value={{ year, thresholdsIn, basinsByType, setYear, setThresholdIn, addBasin, removeBasin, clearBasins }}>
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

export function isChartedType(t: DisplacementType): t is ChartedType {
    return (CHARTED_TYPES as readonly string[]).includes(t)
}

// Resolve the SLD's "Zero" deadband to a single positive bound — the magnitude
// at or below which the SLD treats values as "within uncertainty". Used as the
// default threshold so filter behavior tracks SLD changes automatically.
export function getZeroBound(bins: SldBin[]): number | null {
    const zero = bins.find(b => b.isZero)
    if (!zero) return null
    return Math.max(Math.abs(zero.min), Math.abs(zero.max))
}

function useSldZeroBound(type: ChartedType): number | null {
    const styleName = getStyleNameForType(type) ?? ''
    const { data: bins = [] } = useQuery({
        queryKey: ['sld-bins', styleName],
        queryFn: () => fetchDisplacementSldBins(styleName),
        staleTime: 60 * 60 * 1000,
        enabled: !!styleName,
    })
    return useMemo(() => (bins.length > 0 ? getZeroBound(bins) : null), [bins])
}

/**
 * Resolve effective thresholds (state value if set, otherwise the SLD's Zero
 * deadband, otherwise FALLBACK_THRESHOLD_IN). Charts + cql builders should
 * always go through this rather than reading raw state.
 */
export function useEffectiveThresholdsIn(): Record<ChartedType, number> {
    const { thresholdsIn } = useDisplacementFilters()
    const cumulativeSld = useSldZeroBound('Cumulative')
    const yearlySld = useSldZeroBound('Yearly')
    return useMemo(() => ({
        'Cumulative': thresholdsIn['Cumulative'] ?? cumulativeSld ?? FALLBACK_THRESHOLD_IN,
        'Yearly': thresholdsIn['Yearly'] ?? yearlySld ?? FALLBACK_THRESHOLD_IN,
    }), [thresholdsIn, cumulativeSld, yearlySld])
}

/**
 * Translate filter state into per-layer cql_filter strings keyed by displacement
 * layer title. Combines with each layer's static `type='...'` cql via AND in
 * customLayerParameters — GeoServer concatenates these clauses. Only charted
 * types get a threshold clause (others have no threshold UI to tune it from).
 */
// Escape single quotes per the SQL/CQL string-literal convention so basin names
// containing apostrophes don't break the filter (e.g. "O'Brien Valley").
function quoteCqlLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

export function useDisplacementLayerFilters(): Record<string, string> {
    const { year, basinsByType } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    return useMemo(() => {
        const out: Record<DisplacementLayerTitle, string> = {} as Record<DisplacementLayerTitle, string>
        for (const [title, typeValue] of Object.entries(DISPLACEMENT_LAYER_TYPES) as [DisplacementLayerTitle, DisplacementType][]) {
            const clauses: string[] = []
            if (year !== 'all' && !TYPES_WITHOUT_YEAR.has(typeValue)) {
                clauses.push(`year='${year}'`)
            }
            if (isChartedType(typeValue)) {
                const thresholdIn = effective[typeValue]
                if (thresholdIn > 0) {
                    clauses.push(`(value_inch >= ${thresholdIn} OR value_inch <= ${-thresholdIn})`)
                }
            }
            const basins = basinsByType[typeValue]
            if (basins && basins.size > 0) {
                const list = Array.from(basins).map(quoteCqlLiteral).join(', ')
                clauses.push(`location IN (${list})`)
            }
            if (clauses.length > 0) out[title] = clauses.join(' AND ')
        }
        return out
    }, [year, effective, basinsByType])
}
