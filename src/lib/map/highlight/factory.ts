import maplibregl from 'maplibre-gl';
import { ArcGISHighlight } from './arcgis';
import { MapLibreHighlight } from './maplibre';
import { HighlightProvider } from './types';
import { getMapImplementation } from '../get-map-implementation';

// Cache providers per map instance using WeakMap for automatic cleanup
const maplibreProviderCache = new WeakMap<maplibregl.Map, MapLibreHighlight>();

/**
 * Factory function to create the appropriate highlight provider
 * based on the active map implementation
 *
 * @param view - ArcGIS MapView or SceneView (required if using ArcGIS)
 * @param map - MapLibre map instance (required if using MapLibre)
 * @returns The appropriate HighlightProvider instance
 */
export function createHighlightProvider(
  view?: __esri.SceneView | __esri.MapView,
  map?: maplibregl.Map
): HighlightProvider {
  const implementation = getMapImplementation();

  if (implementation === 'maplibre') {
    if (!map) {
      throw new Error('maplibre map instance is required for maplibre implementation');
    }

    // Reuse the same provider instance for this map to preserve highlight tracking
    let provider = maplibreProviderCache.get(map);
    if (!provider) {
      provider = new MapLibreHighlight(map);
      maplibreProviderCache.set(map, provider);
    }

    return provider;
  }

  if (!view) {
    throw new Error('arcgis view is required for arcgis implementation');
  }
  return new ArcGISHighlight(view);
}

export type { HighlightProvider, HighlightOptions } from './types';
export { ArcGISHighlight, MapLibreHighlight };
