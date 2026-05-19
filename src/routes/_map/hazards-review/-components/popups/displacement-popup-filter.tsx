import type { ExtendedFeature, LayerContentProps } from '@/components/maps/popups/types'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle } from './displacement-layers'

interface FilterState {
    year: string
}

// Types whose features carry null `year` (period-keyed). Year selector can't
// meaningfully include or exclude them, so they always pass through.
const TYPES_WITHOUT_YEAR = new Set(['Cumulative', 'Vertical Displacement Rate'])

/**
 * Returns a predicate that mirrors the year clause in the WMS cql filter on the
 * popup side, so feature cards for non-matching years are hidden when a year is
 * picked. Non-displacement layers and period-keyed displacement types always
 * pass through.
 */
export function makeDisplacementPopupFeatureFilter(state: FilterState) {
    if (state.year === 'all') return undefined
    return (feature: ExtendedFeature, layer: LayerContentProps): boolean => {
        const title = layer.layerTitle || layer.groupLayerTitle || ''
        if (!isDisplacementLayerTitle(title)) return true
        const typeValue = DISPLACEMENT_LAYER_TYPES[title]
        if (TYPES_WITHOUT_YEAR.has(typeValue)) return true
        const fy = (feature.properties as { year?: string } | undefined)?.year
        return fy === state.year
    }
}
