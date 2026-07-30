import type { LayerProps } from '@/lib/types/mapping-types'
import { isPMTilesLayer } from '@/lib/map/layer-utils'
import { SymbologyLegend } from '@/components/sidebar/filter/symbology-legend'
import { powerplantsTitle } from '../../-data/layers/layers'
import { powerplantsFilterSchema } from '../../-data/layers/powerplants-schema'

/**
 * Carbon storage's `layerLegendRender` wiring. The legend engine ({@link SymbologyLegend})
 * is generic + STAC-derived — this just points it at the Power Plants layer's filter
 * schema when that layer renders. Mirrors subsurface's UCRC wiring.
 */
export function renderCarbonStorageLegend(layer: LayerProps): React.ReactNode {
    if (layer.title === powerplantsTitle && isPMTilesLayer(layer)) {
        return <SymbologyLegend layer={layer} schema={powerplantsFilterSchema} />
    }
    return null
}
