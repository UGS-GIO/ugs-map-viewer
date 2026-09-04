/**
 * MapLibre-expression twin of useDisplacementLayerFilters (which builds GeoServer CQL). For the
 * /review-stac vector displacement layers: each per-type layer gets a base `type == X` clause plus the
 * reviewer's year / threshold / basin / data-quality filters, as a MapLibre FilterSpecification keyed by
 * layer title. Fed into GenericMapContainer's vectorLayerFilters. No GeoServer/CQL involved.
 */
import { useMemo } from 'react'
import type { FilterSpecification } from 'maplibre-gl'
import {
    DISPLACEMENT_LAYER_TYPES,
    isChartedType,
    type DisplacementLayerTitle,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementFilters, useEffectiveThresholdsIn } from './displacement-filter-context'
import { useDisplacementLatestYearByType } from './use-displacement-queries'

export function useDisplacementVectorFilters(): Record<string, FilterSpecification> {
    const { yearOverridesByType, basinsByType, excludedDataQualsByType } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    const latestByType = useDisplacementLatestYearByType()
    return useMemo(() => {
        const out: Record<string, FilterSpecification> = {}
        for (const [title, typeValue] of Object.entries(DISPLACEMENT_LAYER_TYPES) as [DisplacementLayerTitle, DisplacementType][]) {
            // Base: this layer shows only its displacement type (3 per-type layers off one pmtiles).
            const clauses: unknown[] = [['==', ['get', 'type'], typeValue]]

            const effectiveYear = yearOverridesByType[typeValue] ?? latestByType[typeValue] ?? null
            if (effectiveYear) {
                // `year` holds the window's closing year for every type — same clause as the cql twin.
                clauses.push(['==', ['to-string', ['get', 'year']], String(effectiveYear)])
            }
            if (isChartedType(typeValue)) {
                const t = effective[typeValue]
                if (t > 0) {
                    const v = ['to-number', ['get', 'value_inches']]
                    clauses.push(['any', ['>=', v, t], ['<=', v, -t]])
                }
            }
            const basins = basinsByType[typeValue]
            if (basins && basins.size > 0) {
                clauses.push(['match', ['get', 'location'], Array.from(basins), true, false])
            }
            const excluded = excludedDataQualsByType[typeValue]
            if (excluded && excluded.size > 0) {
                // data_qual NOT IN (excluded) — keep unknown/future categories visible.
                clauses.push(['!', ['match', ['coalesce', ['get', 'data_qual'], ''], Array.from(excluded), true, false]])
            }
            out[title] = ['all', ...clauses] as unknown as FilterSpecification
        }
        return out
    }, [yearOverridesByType, latestByType, effective, basinsByType, excludedDataQualsByType])
}
