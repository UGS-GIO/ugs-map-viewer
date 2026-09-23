import { useCallback, useMemo } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { getPopulatedBinBoundaries } from './displacement-thresholds'
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
    /**
     * Displacement band bounds. The layer stores each contour as a range;
     * `value_inches_min` is the deep edge and equals the old single value_inches,
     * so charts / filters / thresholds / SLD bins key on it. `value_inches_max` is
     * the shallow edge, used only for the popup range. In/year for the Rate surface.
     */
    value_inches_min: number
    value_inches_max: number
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

// The displacement types the map keys on (each is its own WMS layer).
const YEAR_LOOKUP_TYPES: DisplacementType[] = ['Cumulative', 'Yearly', 'Vertical Displacement Rate']

// Cheap "latest year per type" lookup for the MAP's cql, which needs only the
// year (not geometry). One tiny WFS GetFeature per type — sorted by year
// descending, count=1, year-only — returns in ~0.3s / a few hundred bytes, versus
// the multi-second 20k-feature bulk pull. Decoupling the map's year from that
// pull is what stops every year-window painting stacked while features load.
async function fetchLatestYearsByType(signal: AbortSignal): Promise<Record<DisplacementType, string | null>> {
    const entries = await Promise.all(YEAR_LOOKUP_TYPES.map(async (type): Promise<[DisplacementType, string | null]> => {
        const url = `${PROD_GEOSERVER_URL}/wfs?` + new URLSearchParams({
            service: 'WFS', version: '2.0.0', request: 'GetFeature',
            typeNames: DISPLACEMENT_TYPE_NAME,
            count: '1',
            sortBy: 'year D',
            propertyName: 'year',
            outputFormat: 'application/json',
            CQL_FILTER: `type='${type}'`,
        }).toString()
        // Throw (don't swallow to null): a rejected query retries and exposes
        // isError, and the map gates on the loading state — never a silent blank.
        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(`WFS latest-year lookup failed for ${type}: ${res.status}`)
        const fc = await res.json()
        const y = fc?.features?.[0]?.properties?.year
        return [type, y == null ? null : String(y)]
    }))
    return Object.fromEntries(entries) as Record<DisplacementType, string | null>
}

export const displacementLatestYearsQueryOptions = () => queryOptions({
    queryKey: queryKeys.hazards.displacementLatestYears(),
    queryFn: ({ signal }) => fetchLatestYearsByType(signal),
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

// Distinct |value_inches_min| magnitudes present for a type, ascending. Backs the
// threshold dropdown: an edge only earns a slot when real features sit in the
// band above it, so an SLD class the data never fills (e.g. Cumulative's
// 1–3 in band) doesn't yield a redundant option that filters identically to the
// next one.
export function useDisplacementValueMagnitudesForType(type: DisplacementType): number[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const set = new Set<number>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            const v = f.properties.value_inches_min
            if (typeof v === 'number' && Number.isFinite(v)) set.add(Math.abs(v))
        }
        return Array.from(set).sort((a, b) => a - b)
    }, [type])
    const { data = [] } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

// The per-type default threshold: the smallest data-populated SLD edge (see
// getPopulatedBinBoundaries). Used as the effective default so the map, chart and
// threshold dropdown all agree, and so the map hides the measurement-noise
// deadband by default the way the chart already does. null until both the SLD and
// features have loaded — callers fall back to the SLD deadband, then a constant.
export function useDisplacementDefaultThresholdForType(type: DisplacementType): number | null {
    const styleName = getStyleNameForType(type) ?? ''
    const { data: bins = [] } = useDisplacementSldBins(styleName)
    const magnitudes = useDisplacementValueMagnitudesForType(type)
    return useMemo(() => {
        const edges = getPopulatedBinBoundaries(bins, magnitudes)
        return edges.length > 0 ? edges[0] : null
    }, [bins, magnitudes])
}

// Derive latest year per type from the bulk features array. Used only as the
// fail-loud fallback when the cheap dedicated lookup errors (see
// useDisplacementLatestYearByType) — the year filter is mandatory (no "all years"
// sentinel: picking all years for Cumulative paints every nested window at once
// and makes popups unreadable).
function selectLatestYearsFromFeatures(features: DisplacementFeature[]): Record<DisplacementType, string | null> {
    const latest: Record<string, string | null> = {}
    for (const f of features) {
        const t = f.properties.type
        const y = getBucketYear(f.properties)
        if (!y) continue
        const cur = latest[t]
        if (cur == null || y > cur) latest[t] = y
    }
    return latest as Record<DisplacementType, string | null>
}

export interface DisplacementQualityCaps {
    /** True once any loaded feature reports a non-null data_qual value. */
    dataQual: boolean
}

/**
 * Capability probe for the per-feature data-quality fields. UI surfaces (basin
 * coverage stat, advanced filter) gate on this flag so they stay invisible until
 * the data populates the column. Once data ships, the flag flips on automatically
 * with no caller change.
 *
 * The old numeric `pct_valid` field went away when the layer moved to
 * `hazards_displacement_insar_review`. If a replacement quality metric is
 * surfaced later (e.g. `independent_confirmation` or `avg_temp_coh`), probe it
 * here and add it to DisplacementQualityCaps.
 */
export function useDisplacementHasQualityFields(): DisplacementQualityCaps {
    const select = useCallback((features: DisplacementFeature[]): DisplacementQualityCaps => {
        let dataQual = false
        for (const f of features) {
            if (f.properties.data_qual !== undefined && f.properties.data_qual !== null) {
                dataQual = true
                break
            }
        }
        return { dataQual }
    }, [])
    const { data } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data ?? { dataQual: false }
}

// Minimal settled/loading shape of the two year queries, so the pending
// derivation can be unit-tested without a React Query harness.
interface YearQueryState {
    data?: unknown
    isError: boolean
}

// Is the latest-year lookup still genuinely loading? It MUST return false on every
// terminal state, or a lookup failure gates the map to blank forever (the exact bug
// this cheap-lookup + bulk-fallback exists to prevent). By state:
//   cheap in flight (no data, no error)        → pending
//   cheap errored, bulk fallback in flight      → pending
//   cheap has data / bulk fell back / BOTH fail → settled
// On both-fail we settle with no year; the filter then drops the year clause
// (all-years visible) instead of emitting a no-match `year = -1`. Key off
// .data/.isError, not .isPending — a disabled bulk query reports status 'pending'
// in TanStack v5, so bulk's loading state is only meaningful once cheap errored.
export function isLatestYearLookupPending(cheap: YearQueryState, bulk: YearQueryState): boolean {
    return (!cheap.data && !cheap.isError) || (cheap.isError && !bulk.data && !bulk.isError)
}

// One shared object while neither source has data (loading, or both lookups
// failed), so memos keyed on `byType` don't rebuild on every render.
const NO_LATEST_YEARS: Readonly<Record<DisplacementType, string | null>> = {
    'Cumulative': null,
    'Yearly': null,
    'Vertical Displacement Rate': null,
}

// Per-type latest-year map for callers that need to resolve year filters
// across every type in one pass (e.g. cql_filter assembly).
// Latest year per type, from the cheap dedicated lookup (not the 20k-feature bulk
// pull) so the map's year clause resolves fast and doesn't wait on chart data.
export function useDisplacementLatestYearByType(): { byType: Readonly<Record<DisplacementType, string | null>>; isPending: boolean } {
    const cheap = useQuery(displacementLatestYearsQueryOptions())
    // Fallback source only if the cheap lookup errors — `enabled` keeps the 20k
    // bulk pull off the happy path.
    const bulk = useQuery({ ...displacementFeaturesQueryOptions(), select: selectLatestYearsFromFeatures, enabled: cheap.isError })
    const byType = cheap.data ?? bulk.data ?? NO_LATEST_YEARS
    const isPending = isLatestYearLookupPending(cheap, bulk)
    return { byType, isPending }
}
