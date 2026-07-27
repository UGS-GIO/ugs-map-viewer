import type { LayerProps } from '@/lib/types/mapping-types'
import { isPMTilesLayer } from '@/lib/map/layer-utils'
import { SymbologyLegend } from '@/components/sidebar/filter/symbology-legend'
import { ucrcWellsWMSTitle } from '../../-data/layers/layers'
import { ucrcFilterSchema } from '../../-data/layers/ucrc-schema'

/**
 * Subsurface's `layerLegendRender` wiring. The legend engine
 * ({@link SymbologyLegend}) is generic + STAC-derived — this just points it at the UCRC layer's
 * filter schema when that layer renders. Other routes wire their own the same way.
 */
export function renderSubsurfaceLegend(layer: LayerProps): React.ReactNode {
    if (layer.title === ucrcWellsWMSTitle && isPMTilesLayer(layer)) {
        return <SymbologyLegend layer={layer} schema={ucrcFilterSchema} />
    }
    return null
}
