import maplibregl from 'maplibre-gl';
import { ArcGISLegend } from './arcgis';
import { MapLibreLegend } from './maplibre';
import { LegendProvider } from './types';
import { getMapImplementation } from '../get-map-implementation';

/**
 * Factory function to create the appropriate legend provider
 * based on the active map implementation
 *
 * @param view - ArcGIS MapView or SceneView (required if using ArcGIS)
 * @param map - ArcGIS Map object (required if using ArcGIS)
 * @param maplibreMap - MapLibre map instance (required if using MapLibre)
 * @returns The appropriate LegendProvider instance
 */
export function createLegendProvider(
  view?: __esri.SceneView | __esri.MapView,
  map?: __esri.Map,
  maplibreMap?: maplibregl.Map
): LegendProvider {
  const implementation = getMapImplementation();

  if (implementation === 'maplibre') {
    if (!maplibreMap) {
      throw new Error('MapLibre map instance is required for MapLibre implementation');
    }
    return new MapLibreLegend(maplibreMap);
  }

  // Default to ArcGIS
  if (!view || !map) {
    throw new Error('ArcGIS view and map are required for ArcGIS implementation');
  }
  return new ArcGISLegend(view, map);
}

/**
 * Re-export the types for convenience
 */
export type { LegendProvider, RendererData } from './types';
export { ArcGISLegend, MapLibreLegend };
