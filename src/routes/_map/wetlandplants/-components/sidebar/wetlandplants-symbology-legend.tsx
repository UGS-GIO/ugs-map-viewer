import type { LayerProps } from '@/lib/types/mapping-types';
import { isPMTilesLayer } from '@/lib/map/layer-utils';
import { SymbologyLegend } from '@/components/sidebar/filter/symbology-legend';
import { wetlandSurveySitesTitle } from '../../-data/layers/layers';
import { wetlandPlantsFilterSchema } from '../../-data/layers/wetlandplants-schema';

/**
 * Wetland Plants' `layerLegendRender` wiring. The legend engine
 * ({@link SymbologyLegend}) is generic + STAC-derived — this points it at the
 * Wetland Survey Sites layer's filter schema when that layer renders.
 * Mirrors subsurface's UCRC wiring.
 */
export function renderWetlandPlantsLegend(layer: LayerProps): React.ReactNode {
    if (layer.title === wetlandSurveySitesTitle && isPMTilesLayer(layer)) {
        return <SymbologyLegend layer={layer} schema={wetlandPlantsFilterSchema} />;
    }
    return null;
}
