/**
 * Per-layer custom panels — the generic extension point for "this layer needs more than declarative
 * filters".
 *
 * A layer gets its UI from two composable sources:
 *   1. `filterFields` (declarative, generic)  → <LayerFilters>: enum/range controls, optionally
 *      symbology-driving. Every layer gets this for free, config-based apps included.
 *   2. a plug-in registered here, keyed by STAC item id → bespoke stats/analytics + legend for layers
 *      whose needs can't be expressed declaratively.
 *
 * Displacement is the first plug-in: its `type` is a generic symbology-driving field (so the catalog's one
 * item stays one layer), while its InSAR analytics — basins, water-years, data quality, thresholds,
 * charts — come from the plug-in, scoped to whichever type is active. Adding a bespoke layer later means
 * registering one entry here; it does NOT mean touching the catalog engine or the filter engine.
 */
import type { ReactNode } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { PMTilesLayerProps, LayerProps, FilterFieldSpec } from '@/lib/types/mapping-types';
import { DISPLACEMENT_ITEM_ID } from '@/lib/map/stac/review-catalog-group';
import { activeEnumValue } from '@/lib/map/layer-filters';
import { isGroupLayer, isPMTilesLayer } from '@/lib/map/layer-utils';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import { useReviewFilters } from './review-filter-context';
import { renderDisplacementLayerPanel } from '@/routes/_map/hazards-review/-components/popups/displacement-layer-panel';
import { renderDisplacementLegend } from '@/routes/_map/hazards-review/-components/popups/displacement-legend';
import { useDisplacementVectorFilters } from '@/routes/_map/hazards-review/-components/popups/displacement-vector-filters';
import type { DisplacementType } from '@/routes/_map/hazards-review/-components/popups/displacement-layers';

export interface LayerPanelPlugin {
  /** Bespoke analytics, rendered under the layer's generic filter controls. */
  renderStats?: (layer: PMTilesLayerProps) => ReactNode;
  /** Bespoke legend, replacing the default render-derived one. */
  renderLegend?: (layer: PMTilesLayerProps) => ReactNode;
}

const LAYER_PANEL_PLUGINS: Record<string, LayerPanelPlugin> = {
  [DISPLACEMENT_ITEM_ID]: {
    renderStats: (layer) => <DisplacementStats layer={layer} />,
    renderLegend: (layer) => <DisplacementLegendForActiveType layer={layer} />,
  },
};

export function layerPanelPlugin(layer: PMTilesLayerProps): LayerPanelPlugin | undefined {
  return layer.stacItemId ? LAYER_PANEL_PLUGINS[layer.stacItemId] : undefined;
}

/* ------------------------------------------------------------------ displacement plug-in */

// The bespoke InSAR panel is written per displacement TYPE and keys off these registry titles. The map
// layer is the single catalog layer; these titles are internal to the plug-in only.
const PER_TYPE_REVIEW_TITLE: Record<DisplacementType, string> = {
  'Cumulative': 'Displacement Contours - Cumulative: Review',
  'Yearly': 'Displacement Contours - Yearly: Review',
  'Vertical Displacement Rate': 'Displacement Contours - Vertical Displacement Rate: Review',
};

const symbologyField = (layer?: PMTilesLayerProps): Extract<FilterFieldSpec, { kind: 'enum' }> | undefined =>
  layer?.filterFields?.find((f): f is Extract<FilterFieldSpec, { kind: 'enum' }> => f.kind === 'enum' && !!f.drivesSymbology);

/** Active displacement type = the value of the layer's symbology-driving enum field. Single source of
 *  truth: the same generic filter state drives the map filter, the render, and these analytics. */
function useActiveType(layer?: PMTilesLayerProps): DisplacementType {
  const { values } = useReviewFilters();
  const spec = symbologyField(layer);
  if (!spec) return 'Cumulative';
  return activeEnumValue(spec, values[layer?.title ?? ''] ?? {}) as DisplacementType;
}

function DisplacementStats({ layer }: { layer: PMTilesLayerProps }) {
  return <>{renderDisplacementLayerPanel(PER_TYPE_REVIEW_TITLE[useActiveType(layer)])}</>;
}

function DisplacementLegendForActiveType({ layer }: { layer: PMTilesLayerProps }) {
  return <>{renderDisplacementLegend(PER_TYPE_REVIEW_TITLE[useActiveType(layer)])}</>;
}

function findByStacItemId(layers: LayerProps[], itemId: string): PMTilesLayerProps | undefined {
  for (const l of layers) {
    if (isGroupLayer(l) && l.layers) {
      const r = findByStacItemId(l.layers, itemId);
      if (r) return r;
    } else if (isPMTilesLayer(l) && l.stacItemId === itemId) {
      return l;
    }
  }
  return undefined;
}

/**
 * Map-filter override for the displacement layer. The generic `type` field alone would only filter by
 * type; the InSAR panel additionally constrains year/basin/data-quality/threshold. Those come from the
 * bespoke builder (keyed by per-type title) and are re-keyed onto the single catalog layer's title, so
 * they replace the generic expression for that one layer.
 */
export function useDisplacementFilterOverride(): Record<string, FilterSpecification> {
  const layers = useGetLayerConfigsData('review-stac') ?? [];
  const layer = findByStacItemId(layers, DISPLACEMENT_ITEM_ID);
  const type = useActiveType(layer);
  const byPerTypeTitle = useDisplacementVectorFilters();
  if (!layer?.title) return {};
  const expr = byPerTypeTitle[PER_TYPE_REVIEW_TITLE[type]];
  return expr ? { [layer.title]: expr } : {};
}
