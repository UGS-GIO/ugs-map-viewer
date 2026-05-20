import type { ExtendedFeature, LayerContentProps } from '@/components/maps/popups/types'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle, type DisplacementType } from './displacement-layers'

interface FilterState {
    year: string
    basinsByType: Record<DisplacementType, ReadonlySet<string>>
}

// Types whose features carry null `year` (period-keyed). Year selector can't
// meaningfully include or exclude them, so they always pass through.
const TYPES_WITHOUT_YEAR = new Set(['Cumulative', 'Vertical Displacement Rate'])

/**
 * Returns a predicate that mirrors the year + basin cql clauses on the popup
 * side, so feature cards for non-matching years or unselected basins are hidden
 * inline with the map tiles. Non-displacement layers always pass through;
 * period-keyed types pass through the year check.
 */
export function makeDisplacementPopupFeatureFilter(state: FilterState) {
    const yearActive = state.year !== 'all'
    const basinActiveByType: Record<DisplacementType, boolean> = {
        'Cumulative': state.basinsByType['Cumulative']?.size > 0,
        'Yearly': state.basinsByType['Yearly']?.size > 0,
        'Vertical Displacement Rate': state.basinsByType['Vertical Displacement Rate']?.size > 0,
    }
    const anyActive = yearActive || basinActiveByType['Cumulative'] || basinActiveByType['Yearly'] || basinActiveByType['Vertical Displacement Rate']
    if (!anyActive) return undefined

    return (feature: ExtendedFeature, layer: LayerContentProps): boolean => {
        const title = layer.layerTitle || layer.groupLayerTitle || ''
        if (!isDisplacementLayerTitle(title)) return true
        const typeValue = DISPLACEMENT_LAYER_TYPES[title]
        const props = feature.properties as { year?: string; location?: string } | undefined

        if (yearActive && !TYPES_WITHOUT_YEAR.has(typeValue)) {
            if (props?.year !== state.year) return false
        }
        if (basinActiveByType[typeValue]) {
            const loc = props?.location
            if (!loc || !state.basinsByType[typeValue].has(loc)) return false
        }
        return true
    }
}
