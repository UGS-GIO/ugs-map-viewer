import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
    DISPLACEMENT_LAYER_TYPES,
    CHARTED_TYPES,
    isChartedType,
    isPeriodKeyedType,
    type ChartedType,
    type DisplacementLayerTitle,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementLatestYearByType, useDisplacementSldZeroBound } from './use-displacement-queries'

// Re-export the type predicates + token sets so existing call sites keep
// importing from this module — the canonical definitions now live in
// `displacement-layers.ts` to break a circular import.
export { CHARTED_TYPES, isChartedType, isPeriodKeyedType, type ChartedType }

// Fallback used only when the SLD's "Zero" deadband can't be resolved (network
// failure, schema drift, etc.). Real defaults come from the SLD at runtime.
const FALLBACK_THRESHOLD_IN = 1.2

// `null` means "auto — use the SLD's Zero deadband as the effective threshold."
// A numeric value means the user explicitly tightened or loosened it.
type ThresholdState = number | null

interface DisplacementFilterState {
    /**
     * User-picked year, or null when no override is set. Consumers should
     * resolve the effective year per type via {@link useEffectiveYear} so the
     * map/charts always have a concrete year (null → latest from the SLD data).
     * The "all years" sentinel was removed: returning every nested window for
     * Cumulative made popups dump duplicate rows per overlap.
     */
    yearOverride: string | null
    thresholdsIn: Record<ChartedType, ThresholdState>
    /** Selected basin locations per displacement type. Empty set = no basin filter (all basins). */
    basinsByType: Record<DisplacementType, ReadonlySet<string>>
    setYearOverride: (y: string | null) => void
    setThresholdIn: (type: ChartedType, n: ThresholdState) => void
    addBasin: (type: DisplacementType, location: string) => void
    removeBasin: (type: DisplacementType, location: string) => void
    clearBasins: (type: DisplacementType) => void
}

const DisplacementFilterContext = createContext<DisplacementFilterState | null>(null)

export function DisplacementFilterProvider({ children }: { children: ReactNode }) {
    const [yearOverride, setYearOverride] = useState<string | null>(null)
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
        <DisplacementFilterContext.Provider value={{ yearOverride, thresholdsIn, basinsByType, setYearOverride, setThresholdIn, addBasin, removeBasin, clearBasins }}>
            {children}
        </DisplacementFilterContext.Provider>
    )
}

export function useDisplacementFilters(): DisplacementFilterState {
    const ctx = useContext(DisplacementFilterContext)
    if (!ctx) throw new Error('useDisplacementFilters must be used within DisplacementFilterProvider')
    return ctx
}

/**
 * Resolve the effective year for a displacement type: the user's pick if set,
 * otherwise the latest year present in that type's data. Returns null only
 * while the SLD-feature query is loading.
 */
export function useEffectiveYear(type: DisplacementType): string | null {
    const { yearOverride } = useDisplacementFilters()
    const latestByType = useDisplacementLatestYearByType()
    return yearOverride ?? latestByType[type] ?? null
}

/**
 * Resolve effective thresholds (state value if set, otherwise the SLD's Zero
 * deadband, otherwise FALLBACK_THRESHOLD_IN). Charts + cql builders should
 * always go through this rather than reading raw state.
 */
export function useEffectiveThresholdsIn(): Record<ChartedType, number> {
    const { thresholdsIn } = useDisplacementFilters()
    const cumulativeSld = useDisplacementSldZeroBound('Cumulative')
    const yearlySld = useDisplacementSldZeroBound('Yearly')
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
    const { yearOverride, basinsByType } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    const latestByType = useDisplacementLatestYearByType()
    return useMemo(() => {
        const out: Record<DisplacementLayerTitle, string> = {} as Record<DisplacementLayerTitle, string>
        for (const [title, typeValue] of Object.entries(DISPLACEMENT_LAYER_TYPES) as [DisplacementLayerTitle, DisplacementType][]) {
            const clauses: string[] = []
            const effectiveYear = yearOverride ?? latestByType[typeValue] ?? null
            if (effectiveYear) {
                if (isPeriodKeyedType(typeValue)) {
                    // Period-keyed types (Cumulative, Vertical Displacement Rate) match
                    // by end_date year — picks the observation window closing in that
                    // year. `end_date` is a timestamp column, so LIKE fails server-side
                    // (`operator does not exist: timestamp ~~ unknown`) and GeoServer
                    // throws IOException → broken tiles. Use a half-open date range.
                    const nextYear = Number(effectiveYear) + 1
                    clauses.push(`end_date >= '${effectiveYear}-01-01T00:00:00Z' AND end_date < '${nextYear}-01-01T00:00:00Z'`)
                } else {
                    // Year-keyed types (Yearly) match the water year column directly.
                    clauses.push(`year='${effectiveYear}'`)
                }
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
    }, [yearOverride, latestByType, effective, basinsByType])
}
