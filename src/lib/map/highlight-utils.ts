import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import Graphic from '@arcgis/core/Graphic';
import { createHighlightProvider } from './highlight/factory';
import type { HighlightOptions } from './highlight/types';

export type { HighlightOptions };

/**
 * Highlight a feature on the map
 * Supports both ArcGIS (view) and MapLibre (map) implementations
 */
export const highlightFeature = async (
  feature: Feature<Geometry, GeoJsonProperties>,
  viewOrMap: __esri.MapView | __esri.SceneView | any,
  sourceCRS: string,
  title: string,
  options?: HighlightOptions
): Promise<Graphic | null> => {
  // Determine if this is an ArcGIS view or MapLibre map
  const isArcGIS = viewOrMap?.type === 'map' || viewOrMap?.goTo;

  const provider = isArcGIS
    ? createHighlightProvider(viewOrMap, undefined)
    : createHighlightProvider(undefined, viewOrMap);

  const success = await provider.highlightFeature(feature, sourceCRS, title, options);
  return success ? ({} as Graphic) : null;
};

/**
 * Clear graphics from the map
 * Supports both ArcGIS (view) and MapLibre (map) implementations
 */
export const clearGraphics = (
  viewOrMap: __esri.MapView | __esri.SceneView | any,
  title?: string
) => {
  // Determine if this is an ArcGIS view or MapLibre map
  const isArcGIS = viewOrMap?.type === 'map' || viewOrMap?.goTo;

  const provider = isArcGIS
    ? createHighlightProvider(viewOrMap, undefined)
    : createHighlightProvider(undefined, viewOrMap);

  provider.clearGraphics(title);
};

/**
 * Create a pin marker on the map
 * Supports both ArcGIS (view) and MapLibre (map) implementations
 */
export function createPinGraphic(
  lat: number,
  long: number,
  viewOrMap: __esri.SceneView | __esri.MapView | any
) {
  // Determine if this is an ArcGIS view or MapLibre map
  const isArcGIS = viewOrMap?.type === 'map' || viewOrMap?.goTo;

  const provider = isArcGIS
    ? createHighlightProvider(viewOrMap, undefined)
    : createHighlightProvider(undefined, viewOrMap);

  provider.createPinGraphic(lat, long);
}
