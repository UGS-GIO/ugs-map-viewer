import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
    DISPLACEMENT_LAYER_TYPES,
    CHARTED_TYPES,
    DEFAULT_EXCLUDED_DATA_QUALS,
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

// One honest threshold override per charted type. `null` = use the SLD's "Zero"
// deadband default. A number is the reviewer's pick and applies everywhere —
// map cql, chart bar, and KPIs all read the same effective value (no hidden
// visual-vs-audit split).
type ThresholdState = number | null

interface DisplacementFilterState {
    /**
     * Per-type user-picked year, or null when no override is set for that type.
     * Per-type (not global) so clicking a year on one layer's chart never
     * retargets another layer. Consumers resolve the effective year via
     * {@link useEffectiveYear} (null → latest from the SLD data). The "all years"
     * sentinel was removed: every nested Cumulative window dumped duplicate rows.
     */
    yearOverridesByType: Record<DisplacementType, string | null>
    /** Per-charted-type threshold override (null = SLD default). See {@link useEffectiveThresholdsIn}. */
    thresholdsIn: Record<ChartedType, ThresholdState>
    /** Selected basin locations per displacement type. Empty set = no basin filter (all basins). */
    basinsByType: Record<DisplacementType, ReadonlySet<string>>
    /**
     * Per-type set of data_qual categories the reviewer has UNCHECKED. Empty set
     * = nothing excluded = all qualities shown (no filter). Storing exclusions
     * (not selections) keeps "all = no filter" trivial and is future-proof: a new
     * backend category shows by default until someone unchecks it.
     */
    excludedDataQualsByType: Record<DisplacementType, ReadonlySet<string>>
    setYearOverride: (type: DisplacementType, y: string | null) => void
    setThreshold: (type: ChartedType, n: ThresholdState) => void
    addBasin: (type: DisplacementType, location: string) => void
    removeBasin: (type: DisplacementType, location: string) => void
    clearBasins: (type: DisplacementType) => void
    toggleDataQual: (type: DisplacementType, qual: string) => void
    clearDataQuals: (type: DisplacementType) => void
}

const DisplacementFilterContext = createContext<DisplacementFilterState | null>(null)

// Persisted as a JSON string inside the shared `filters` search record (the same
// per-layer filter slot every map uses — see useLayerFilter / _map.tsx), keyed by
// the displacement layer group. year = period/water-year override;
// thresholds/basins/excludedQuals are keyed by displacement type. An absent
// per-type `excludedQuals` entry means the high/medium default applies.
const DISPLACEMENT_FILTER_KEY = 'Displacement Contours'

interface DisplacementSearch {
    years?: Record<string, string>
    thresholds?: Record<string, number>
    basins?: Record<string, string[]>
    excludedQuals?: Record<string, string[]>
}

const DEFAULT_EXCLUDED_SET = new Set<string>(DEFAULT_EXCLUDED_DATA_QUALS)
const isDefaultQuals = (arr: readonly string[]): boolean =>
    arr.length === DEFAULT_EXCLUDED_SET.size && arr.every(q => DEFAULT_EXCLUDED_SET.has(q))

// Stored exclusion array for a type, falling back to the high/medium default
// when the URL hasn't recorded one.
const readExcluded = (d: DisplacementSearch | undefined, type: DisplacementType): string[] =>
    d?.excludedQuals?.[type] ?? [...DEFAULT_EXCLUDED_DATA_QUALS]

// Collapse an all-default displacement object to undefined so the URL param
// drops out entirely once every filter is back at its default.
function pruneDisplacement(d: DisplacementSearch): DisplacementSearch | undefined {
    const years = d.years && Object.values(d.years).some(v => v) ? d.years : undefined
    const thresholds = d.thresholds && Object.keys(d.thresholds).length ? d.thresholds : undefined
    const basins = d.basins && Object.values(d.basins).some(a => a && a.length) ? d.basins : undefined
    const excludedQuals = d.excludedQuals && Object.keys(d.excludedQuals).length ? d.excludedQuals : undefined
    if (!years && !thresholds && !basins && !excludedQuals) return undefined
    return {
        ...(years ? { years } : {}),
        ...(thresholds ? { thresholds } : {}),
        ...(basins ? { basins } : {}),
        ...(excludedQuals ? { excludedQuals } : {}),
    }
}

// Parse the JSON-encoded displacement entry out of the `filters` record. Returns
// undefined for a missing/blank/corrupt value so the provider falls back to
// defaults instead of throwing on a hand-edited URL.
function parseDisplacement(raw: string | undefined): DisplacementSearch | undefined {
    if (!raw) return undefined
    try {
        const o = JSON.parse(raw)
        return o && typeof o === 'object' && !Array.isArray(o) ? (o as DisplacementSearch) : undefined
    } catch {
        return undefined
    }
}

export function DisplacementFilterProvider({ children }: { children: ReactNode }) {
    // Filter state lives in the shared `filters` URL record (the same per-layer
    // filter slot every map uses), JSON-encoded under DISPLACEMENT_FILTER_KEY, so
    // it survives reloads and is shareable. strict:false matches useLayerFilter.
    const navigate = useNavigate()
    const search = useSearch({ strict: false }) as { filters?: Record<string, string> }
    const raw = search.filters?.[DISPLACEMENT_FILTER_KEY]
    const d = useMemo(() => parseDisplacement(raw), [raw])

    const yearsRec = d?.years
    const yearOverridesByType = useMemo<Record<DisplacementType, string | null>>(() => ({
        'Cumulative': yearsRec?.['Cumulative'] ?? null,
        'Yearly': yearsRec?.['Yearly'] ?? null,
        'Vertical Displacement Rate': yearsRec?.['Vertical Displacement Rate'] ?? null,
    }), [yearsRec])

    const thresholdsIn = useMemo<Record<ChartedType, ThresholdState>>(() => ({
        'Cumulative': d?.thresholds?.['Cumulative'] ?? null,
        'Yearly': d?.thresholds?.['Yearly'] ?? null,
    }), [d?.thresholds])

    const basinsByType = useMemo<Record<DisplacementType, ReadonlySet<string>>>(() => ({
        'Cumulative': new Set(d?.basins?.['Cumulative'] ?? []),
        'Yearly': new Set(d?.basins?.['Yearly'] ?? []),
        'Vertical Displacement Rate': new Set(d?.basins?.['Vertical Displacement Rate'] ?? []),
    }), [d?.basins])

    const excludedQualsRec = d?.excludedQuals
    const excludedDataQualsByType = useMemo<Record<DisplacementType, ReadonlySet<string>>>(() => ({
        'Cumulative': new Set(excludedQualsRec?.['Cumulative'] ?? DEFAULT_EXCLUDED_DATA_QUALS),
        'Yearly': new Set(excludedQualsRec?.['Yearly'] ?? DEFAULT_EXCLUDED_DATA_QUALS),
        'Vertical Displacement Rate': new Set(excludedQualsRec?.['Vertical Displacement Rate'] ?? DEFAULT_EXCLUDED_DATA_QUALS),
    }), [excludedQualsRec])

    // All writes route through the shared `filters` record: read the current
    // displacement JSON, apply the mutation, prune to undefined when all-default,
    // and merge back without disturbing other layers' filter entries (e.g. UCRC).
    // Mirrors useLayerFilter's writeCql.
    const update = useCallback((mut: (cur: DisplacementSearch) => DisplacementSearch) => {
        navigate({
            to: '.',
            replace: true,
            search: (prev: Record<string, unknown>) => {
                const prevFilters = prev.filters && typeof prev.filters === 'object' && !Array.isArray(prev.filters)
                    ? { ...(prev.filters as Record<string, string>) }
                    : {}
                const cur = parseDisplacement(prevFilters[DISPLACEMENT_FILTER_KEY]) ?? {}
                const next = pruneDisplacement(mut(cur))
                if (next) prevFilters[DISPLACEMENT_FILTER_KEY] = JSON.stringify(next)
                else delete prevFilters[DISPLACEMENT_FILTER_KEY]
                return { ...prev, filters: Object.keys(prevFilters).length > 0 ? prevFilters : undefined }
            },
        })
    }, [navigate])

    const setYearOverride = useCallback((type: DisplacementType, y: string | null) => {
        update(cur => {
            const years = { ...cur.years }
            if (y === null) delete years[type]
            else years[type] = y
            return { ...cur, years }
        })
    }, [update])

    const setThreshold = useCallback((type: ChartedType, n: ThresholdState) => {
        update(cur => {
            const thresholds = { ...cur.thresholds }
            if (n === null) delete thresholds[type]
            else thresholds[type] = n
            return { ...cur, thresholds }
        })
    }, [update])

    const toggleDataQual = useCallback((type: DisplacementType, qual: string) => {
        update(cur => {
            const set = new Set(readExcluded(cur, type))
            if (set.has(qual)) set.delete(qual)
            else set.add(qual)
            const arr = [...set]
            const excludedQuals = { ...cur.excludedQuals }
            // Drop the key when back at the default so the URL stays clean.
            if (isDefaultQuals(arr)) delete excludedQuals[type]
            else excludedQuals[type] = arr
            return { ...cur, excludedQuals }
        })
    }, [update])

    // "Reset" returns to the high/medium default = drop the per-type key.
    const clearDataQuals = useCallback((type: DisplacementType) => {
        update(cur => {
            if (!cur.excludedQuals?.[type]) return cur
            const excludedQuals = { ...cur.excludedQuals }
            delete excludedQuals[type]
            return { ...cur, excludedQuals }
        })
    }, [update])

    const addBasin = useCallback((type: DisplacementType, location: string) => {
        update(cur => {
            const set = new Set(cur.basins?.[type] ?? [])
            set.add(location)
            return { ...cur, basins: { ...cur.basins, [type]: [...set] } }
        })
    }, [update])

    const removeBasin = useCallback((type: DisplacementType, location: string) => {
        update(cur => {
            const set = new Set(cur.basins?.[type] ?? [])
            set.delete(location)
            const basins = { ...cur.basins }
            if (set.size) basins[type] = [...set]
            else delete basins[type]
            return { ...cur, basins }
        })
    }, [update])

    const clearBasins = useCallback((type: DisplacementType) => {
        update(cur => {
            if (!cur.basins?.[type]) return cur
            const basins = { ...cur.basins }
            delete basins[type]
            return { ...cur, basins }
        })
    }, [update])

    return (
        <DisplacementFilterContext.Provider value={{ yearOverridesByType, thresholdsIn, basinsByType, excludedDataQualsByType, setYearOverride, setThreshold, addBasin, removeBasin, clearBasins, toggleDataQual, clearDataQuals }}>
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
    const { yearOverridesByType } = useDisplacementFilters()
    const latestByType = useDisplacementLatestYearByType()
    return yearOverridesByType[type] ?? latestByType[type] ?? null
}

/**
 * Resolve the effective threshold per charted type: the reviewer's override if
 * set, else the SLD's "Zero" deadband, else FALLBACK_THRESHOLD_IN while the SLD
 * loads. This single value drives the map cql, the stacked bar, AND the KPIs —
 * one honest knob, no visual-vs-audit split.
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
    const { yearOverridesByType, basinsByType, excludedDataQualsByType } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    const latestByType = useDisplacementLatestYearByType()
    return useMemo(() => {
        const out: Record<DisplacementLayerTitle, string> = {} as Record<DisplacementLayerTitle, string>
        for (const [title, typeValue] of Object.entries(DISPLACEMENT_LAYER_TYPES) as [DisplacementLayerTitle, DisplacementType][]) {
            const clauses: string[] = []
            const effectiveYear = yearOverridesByType[typeValue] ?? latestByType[typeValue] ?? null
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
            // Data-quality: exclude unchecked categories. Empty exclusion set =
            // no clause (all qualities shown). NOT IN keeps unknown future
            // categories visible by default.
            const excludedQuals = excludedDataQualsByType[typeValue]
            if (excludedQuals && excludedQuals.size > 0) {
                const list = Array.from(excludedQuals).map(quoteCqlLiteral).join(', ')
                clauses.push(`data_qual NOT IN (${list})`)
            }
            if (clauses.length > 0) out[title] = clauses.join(' AND ')
        }
        return out
    }, [yearOverridesByType, latestByType, effective, basinsByType, excludedDataQualsByType])
}
