import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import Graphic from '@arcgis/core/Graphic';
import { createHighlightProvider } from './highlight/factory';
import type { HighlightOptions } from './highlight/types';

export type { HighlightOptions };

/**
 * Highlight a feature on the map
 * @deprecated Use createHighlightProvider() factory for new code
 * This function provides backward compatibility for existing code
 */
export const highlightFeature = async (
  feature: Feature<Geometry, GeoJsonProperties>,
  view: __esri.MapView | __esri.SceneView,
  sourceCRS: string,
  title: string,
  options?: HighlightOptions
): Promise<Graphic | null> => {
  const provider = createHighlightProvider(view, undefined);
  const success = await provider.highlightFeature(feature, sourceCRS, title, options);
  return success ? ({} as Graphic) : null;
};

/**
 * Clear graphics from the map
 * @deprecated Use createHighlightProvider() factory for new code
 * This function provides backward compatibility for existing code
 */
export const clearGraphics = (
  view: __esri.MapView | __esri.SceneView,
  title?: string
) => {
  const provider = createHighlightProvider(view, undefined);
  provider.clearGraphics(title);
};

/**
 * Create a pin marker on the map
 * @deprecated Use createHighlightProvider() factory for new code
 * This function provides backward compatibility for existing code
 */
export function createPinGraphic(
  lat: number,
  long: number,
  view: __esri.SceneView | __esri.MapView
) {
  const provider = createHighlightProvider(view, undefined);
  provider.createPinGraphic(lat, long);
}
