import { useCallback } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { queryKeys } from '@/lib/query-keys'
import { fetchWfsFeatures } from '@/lib/map/wfs-service'
import { DATA_QUAL_ORDER, DISPLACEMENT_TYPE_NAME, getStyleNameForType, type ChartedType, type DisplacementType } from './displacement-layers'
import { fetchDisplacementSldBins, getZeroBound, type SldBin } from './displacement-sld-legend'

export interface DisplacementProps {
    location: string
    type: DisplacementType
    /** Year the observation window closes. Populated for every type. */
    year: number | null
    /** Window open date (timestamp). For Cumulative this is the fixed period start. */
    start_date?: string | null
    end_date?: string | null
    value_inches: number
    /**
     * Percentage of source pixels classed as valid (0–100). Backend addition —
     * optional today, populated once the data-quality enrichment lands. UI
     * gates on {@link useDisplacementHasQualityFields} so absence is silent.
     */
    pct_valid?: number | null
    /**
     * Data-quality confidence indicator. Pending backend confirmation on
     * whether this is numeric (0–1 / 0–100) or categorical (e.g. A/B/C);
     * typed permissively until the rollout spec is finalized.
     */
    data_qual?: number | string | null
}

export type DisplacementFeature = Feature<Polygon | MultiPolygon, DisplacementProps>

// `year` is the window's closing year for every type, so one accessor serves
// charts, filters and popups. String-keyed because it indexes option lists.
export function getBucketYear(props: Pick<DisplacementProps, 'year'>): string | null {
    return props.year == null ? null : String(props.year)
}

async function fetchAllDisplacement(): Promise<DisplacementFeature[]> {
    const fc = await fetchWfsFeatures<Polygon | MultiPolygon, DisplacementProps>(
        `${PROD_GEOSERVER_URL}/wfs`,
        DISPLACEMENT_TYPE_NAME,
        { count: 20000 },
    )
    return fc.features
}

// Single source of truth for the bulk WFS pull. Every chart/filter/legend that
// needs displacement features goes through this — TanStack dedupes the network
// hit across subscribers and lets `queryClient.prefetchQuery(...)` warm the
// cache without coupling to a component.
export const displacementFeaturesQueryOptions = () => queryOptions({
    queryKey: queryKeys.hazards.displacementFeatures(),
    queryFn: fetchAllDisplacement,
    // 20k feature pull is expensive; treat as session-stable. gcTime keeps it
    // around long enough that a user toggling layers off+on doesn't refetch.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
})

export const displacementSldBinsQueryOptions = (styleName: string) => queryOptions({
    queryKey: queryKeys.hazards.displacementSldBins(styleName),
    queryFn: () => fetchDisplacementSldBins(styleName),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!styleName,
})

export function useDisplacementFeatures() {
    return useQuery(displacementFeaturesQueryOptions())
}

// Per-type slicing pushed through `select` so React Query memoizes the filtered
// array by callback identity — components reading only one type don't re-render
// when an unrelated type's features change shape.
export function useDisplacementFeaturesByType(type: DisplacementType) {
    const select = useCallback(
        (features: DisplacementFeature[]) => features.filter(f => f.properties.type === type),
        [type],
    )
    return useQuery({ ...displacementFeaturesQueryOptions(), select })
}

export function useDisplacementSldBins(styleName: string) {
    return useQuery(displacementSldBinsQueryOptions(styleName))
}

// Resolve the SLD "Zero" deadband for a charted type. Returns null when bins
// aren't loaded yet or the style omits a Zero rule.
export function useDisplacementSldZeroBound(type: ChartedType): number | null {
    const styleName = getStyleNameForType(type) ?? ''
    const select = useCallback(
        (bins: SldBin[]) => (bins.length > 0 ? getZeroBound(bins) : null),
        [],
    )
    const { data = null } = useQuery({
        ...displacementSldBinsQueryOptions(styleName),
        select,
    })
    return data
}

// Distinct, sorted values of one property across a type's features, derived in
// TanStack `select` so the raw 20k-feature array never reaches the component.
// Backs the year / basin / data-quality option lists — extractor + sort are the
// only things that differ between them.
function useDistinctByType(
    type: DisplacementType,
    extract: (p: DisplacementProps) => string | null | undefined,
    sort?: (a: string, b: string) => number,
): string[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const set = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            const v = extract(f.properties)
            if (v) set.add(v)
        }
        return Array.from(set).sort(sort)
    }, [type, extract, sort])
    const { data = [] } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

// Module-level extractors/sorters so the `select` callback stays referentially
// stable (TanStack memoizes by callback identity).
const extractLocation = (p: DisplacementProps) => p.location
const extractDataQual = (p: DisplacementProps) =>
    typeof p.data_qual === 'string' && p.data_qual.trim() ? p.data_qual : null
// data_qual best→worst via DATA_QUAL_ORDER; unknown categories sort last, alphabetically.
const sortByDataQualOrder = (a: string, b: string) => {
    const order = DATA_QUAL_ORDER as readonly string[]
    const ia = order.indexOf(a), ib = order.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b)
}

export function useDisplacementYearsForType(type: DisplacementType): string[] {
    return useDistinctByType(type, getBucketYear)
}

export function useDisplacementBasinsForType(type: DisplacementType): string[] {
    return useDistinctByType(type, extractLocation)
}

export interface DisplacementBasinYearIndex {
    /** Years with at least one feature, per basin. */
    yearsByBasin: Record<string, ReadonlySet<string>>
    /** Basins with at least one feature, per year. */
    basinsByYear: Record<string, ReadonlySet<string>>
}

const EMPTY_INDEX: DisplacementBasinYearIndex = { yearsByBasin: {}, basinsByYear: {} }

// Cross-index of basin <-> year coverage for a type, built in one pass over
// the raw feature array. Backs the filter panel's mutual graying: picking a
// basin narrows which years have data for it, and picking a year narrows
// which basins have data for it.
export function useDisplacementBasinYearIndexForType(type: DisplacementType): DisplacementBasinYearIndex {
    const select = useCallback((features: DisplacementFeature[]): DisplacementBasinYearIndex => {
        const yearsByBasin: Record<string, Set<string>> = {}
        const basinsByYear: Record<string, Set<string>> = {}
        for (const f of features) {
            if (f.properties.type !== type) continue
            const basin = f.properties.location
            const year = getBucketYear(f.properties)
            if (!basin || !year) continue
            ;(yearsByBasin[basin] ??= new Set()).add(year)
            ;(basinsByYear[year] ??= new Set()).add(basin)
        }
        return { yearsByBasin, basinsByYear }
    }, [type])
    const { data = EMPTY_INDEX } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

export function useDisplacementDataQualsForType(type: DisplacementType): string[] {
    return useDistinctByType(type, extractDataQual, sortByDataQualOrder)
}

// Distinct |value_inches| magnitudes present for a type, ascending. Backs the
// threshold dropdown: an edge only earns a slot when real features sit in the
// band above it, so an SLD class the data never fills (e.g. Cumulative's
// 1–3 in band) doesn't yield a redundant option that filters identically to the
// next one.
export function useDisplacementValueMagnitudesForType(type: DisplacementType): number[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const set = new Set<number>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            const v = f.properties.value_inches
            if (typeof v === 'number' && Number.isFinite(v)) set.add(Math.abs(v))
        }
        return Array.from(set).sort((a, b) => a - b)
    }, [type])
    const { data = [] } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

// Latest year present for a given type — Yearly uses water year, period-keyed
// types use end_date year. Drives the default selection when no explicit
// override is in place (the year filter is mandatory: no "all years" sentinel
// any more, since picking all years for Cumulative paints every nested window
// at once and makes popups unreadable).
export function useDisplacementLatestYearForType(type: DisplacementType): string | null {
    const select = useCallback((features: DisplacementFeature[]) => {
        let latest: string | null = null
        for (const f of features) {
            if (f.properties.type !== type) continue
            const y = getBucketYear(f.properties)
            if (y && (latest === null || y > latest)) latest = y
        }
        return latest
    }, [type])
    const { data = null } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

export interface DisplacementQualityCaps {
    /** True once any loaded feature reports a numeric pct_valid value. */
    pctValid: boolean
    /** True once any loaded feature reports a non-null data_qual value. */
    dataQual: boolean
}

/**
 * Capability probe for the per-feature data-quality fields. UI surfaces (popup
 * confidence chip, basin coverage stat, advanced filter) gate on these flags
 * so they stay invisible until the backend enrichment populates the columns.
 * Once data ships, the flags flip on automatically with no caller change.
 */
export function useDisplacementHasQualityFields(): DisplacementQualityCaps {
    const select = useCallback((features: DisplacementFeature[]): DisplacementQualityCaps => {
        let pctValid = false
        let dataQual = false
        for (const f of features) {
            if (!pctValid && typeof f.properties.pct_valid === 'number') pctValid = true
            if (!dataQual && f.properties.data_qual !== undefined && f.properties.data_qual !== null) dataQual = true
            if (pctValid && dataQual) break
        }
        return { pctValid, dataQual }
    }, [])
    const { data } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data ?? { pctValid: false, dataQual: false }
}

// Per-type latest-year map for callers that need to resolve year filters
// across every type in one pass (e.g. cql_filter assembly).
export function useDisplacementLatestYearByType(): Record<DisplacementType, string | null> {
    const select = useCallback((features: DisplacementFeature[]) => {
        const latest: Record<string, string | null> = {}
        for (const f of features) {
            const t = f.properties.type
            const y = getBucketYear(f.properties)
            if (!y) continue
            const cur = latest[t] ?? null
            if (cur === null || y > cur) latest[t] = y
        }
        return latest as Record<DisplacementType, string | null>
    }, [])
    const { data } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data ?? ({} as Record<DisplacementType, string | null>)
}
