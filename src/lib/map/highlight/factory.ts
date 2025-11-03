import maplibregl from 'maplibre-gl';
import { ArcGISHighlight } from './arcgis';
import { MapLibreHighlight } from './maplibre';
import { HighlightProvider } from './types';
import { getMapImplementation } from '../get-map-implementation';

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
    return new MapLibreHighlight(map);
  }

  if (!view) {
    throw new Error('arcgis view is required for arcgis implementation');
  }
  return new ArcGISHighlight(view);
}

export type { HighlightProvider, HighlightOptions } from './types';
export { ArcGISHighlight, MapLibreHighlight };
