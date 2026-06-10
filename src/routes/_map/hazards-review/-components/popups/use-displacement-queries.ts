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
    year: string | null
    /** Window open date (timestamp). For Cumulative this is the fixed period start. */
    start_date?: string | null
    end_date?: string | null
    value_inch: number
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

// Cumulative features carry null `year` and a period like "2017-10-20 to 2021-10-11";
// bucket them by the period's end year so charts/filters stay year-aligned. Yearly
// uses its native `year` field; VDR + others fall through to null.
export function getBucketYear(props: Pick<DisplacementProps, 'type' | 'year' | 'end_date'>): string | null {
    if (props.type === 'Yearly') return props.year ?? null
    if (props.type === 'Cumulative' && props.end_date) return props.end_date.slice(0, 4)
    return null
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

export function useDisplacementYearsForType(type: DisplacementType): string[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const ys = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            const y = getBucketYear(f.properties)
            if (y) ys.add(y)
        }
        return Array.from(ys).sort()
    }, [type])
    const { data = [] } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

export function useDisplacementBasinsForType(type: DisplacementType): string[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const set = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            if (f.properties.location) set.add(f.properties.location)
        }
        return Array.from(set).sort()
    }, [type])
    const { data = [] } = useQuery({ ...displacementFeaturesQueryOptions(), select })
    return data
}

// Distinct data_qual categories present for a type, ordered best→worst via
// DATA_QUAL_ORDER (unknown categories sort to the end, alphabetically). Drives
// the data-quality filter checkboxes so only present categories show.
export function useDisplacementDataQualsForType(type: DisplacementType): string[] {
    const select = useCallback((features: DisplacementFeature[]) => {
        const set = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== type) continue
            const q = f.properties.data_qual
            if (typeof q === 'string' && q.trim()) set.add(q)
        }
        const order = DATA_QUAL_ORDER as readonly string[]
        return Array.from(set).sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b)
            if (ia !== -1 && ib !== -1) return ia - ib
            if (ia !== -1) return -1
            if (ib !== -1) return 1
            return a.localeCompare(b)
        })
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
