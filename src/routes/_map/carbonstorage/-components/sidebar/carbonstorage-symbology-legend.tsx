import type { LayerProps } from '@/lib/types/mapping-types'
import { isPMTilesLayer } from '@/lib/map/layer-utils'
import { SymbologyLegend } from '@/components/sidebar/filter/symbology-legend'
import { powerplantsTitle, seamlessGeolunitsTitle } from '../../-data/layers/layers'
import { powerplantsFilterSchema } from '../../-data/layers/powerplants-schema'

/**
 * Carbon storage's `layerLegendRender` wiring. The legend engine ({@link SymbologyLegend})
 * is generic + STAC-derived — this points it at the Power Plants layer's filter
 * schema when that layer renders, and suppresses the 500k Geologic Units legend.
 */
export function renderCarbonStorageLegend(layer: LayerProps): React.ReactNode {
    if (layer.title === powerplantsTitle && isPMTilesLayer(layer)) {
        return <SymbologyLegend layer={layer} schema={powerplantsFilterSchema} />
    }
    if (layer.title === seamlessGeolunitsTitle) {
        return <div className="px-1 py-1 text-xs text-muted-foreground italic">No Legend Provided</div>
    }
    return null
}
