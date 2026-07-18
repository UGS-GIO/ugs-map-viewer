import { useMemo } from 'react';
import { LayerProps } from '@/lib/types/mapping-types';
import { isGroupLayer, isWMSLayer } from '@/lib/map/layer-utils';
import { useGetLayerConfigsData } from './use-get-layer-configs';

export interface LayerOption {
  value: string; // workspace-qualified sublayer name, e.g. 'hazards:hazards_qfaults_current'
  label: string; // friendly title from the parent WMS layer
}

// A layer is "reviewable" when its GeoServer sublayer points at a review matview — those names end in
// `_current` (the promoted-under-review matview) or `_review`. Derived straight from the static
// hazards-review layer config (useGetLayerConfigs), so no PostGREST round-trip.
const REVIEW_NAME = /(_current|_review)$/;

/**
 * The reviewable hazard layers for the comments picker — derived from the hazards-review page's own
 * layer config, not a PostGREST lookup. `value` is the sublayer name a warehouse STAC item id maps from
 * (see `layerToItemId`); `label` is the parent layer's title.
 */
export const useFetchReviewableLayers = (): { data: LayerOption[] } => {
  const layerConfig = useGetLayerConfigsData('layers');

  const data = useMemo<LayerOption[]>(() => {
    if (!layerConfig) return [];
    const byValue = new Map<string, string>();

    const walk = (layers: LayerProps[]) => {
      for (const layer of layers) {
        if (isWMSLayer(layer)) {
          for (const sub of layer.sublayers) {
            if (sub.name && sub.queryable !== false && REVIEW_NAME.test(sub.name) && !byValue.has(sub.name)) {
              byValue.set(sub.name, layer.title);
            }
          }
        } else if (isGroupLayer(layer) && layer.layers) {
          walk(layer.layers);
        }
      }
    };
    walk(layerConfig);

    return [...byValue.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [layerConfig]);

  return { data };
};
