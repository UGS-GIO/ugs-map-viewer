import type { ExtendedFeature, LayerContentProps } from '@/components/maps/popups/types'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle, isPeriodKeyedType, type DisplacementType } from './displacement-layers'

interface PopupFilterInputs {
    /** Resolved per-type year (user override or latest from data). Null = still loading for that type. */
    effectiveYearByType: Record<DisplacementType, string | null>
    basinsByType: Record<DisplacementType, ReadonlySet<string>>
}

/**
 * Returns a predicate that mirrors the year + basin cql clauses on the popup
 * side, so feature cards for non-matching years or unselected basins are hidden
 * inline with the map tiles. Year filter matches the water year column for
 * Yearly, and the end_date year for period-keyed types (Cumulative + VDR).
 *
 * Mirrors the map cql exactly: the year clause only applies once a type's
 * effective year resolves. While it is null (data still loading, or a type
 * with no year bucket) no year filter is applied — same as the map tiles, so
 * popup cards never disagree with what's drawn.
 */
export function makeDisplacementPopupFeatureFilter({ effectiveYearByType, basinsByType }: PopupFilterInputs) {
    return (feature: ExtendedFeature, layer: LayerContentProps): boolean => {
        const title = layer.layerTitle || layer.groupLayerTitle || ''
        if (!isDisplacementLayerTitle(title)) return true
        const typeValue = DISPLACEMENT_LAYER_TYPES[title]
        const props = feature.properties as { year?: string; location?: string; end_date?: string } | undefined

        const effectiveYear = effectiveYearByType[typeValue]
        if (effectiveYear) {
            if (isPeriodKeyedType(typeValue)) {
                const endYear = props?.end_date?.slice(0, 4)
                if (endYear !== effectiveYear) return false
            } else {
                if (props?.year !== effectiveYear) return false
            }
        }

        const basins = basinsByType[typeValue]
        if (basins && basins.size > 0) {
            const loc = props?.location
            if (!loc || !basins.has(loc)) return false
        }
        return true
    }
}
