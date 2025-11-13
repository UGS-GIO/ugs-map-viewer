import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { createHighlightProvider } from './highlight/factory';
import type { HighlightOptions } from './highlight/types';
import type { MapLibreMap } from '@/lib/types/map-types';

export type { HighlightOptions };

/**
 * Highlight a feature on the MapLibre map
 */
export const highlightFeature = async (
  feature: Feature<Geometry, GeoJsonProperties>,
  map: MapLibreMap,
  sourceCRS: string,
  title: string,
  options?: HighlightOptions
): Promise<boolean> => {
  const provider = createHighlightProvider(map);
  return await provider.highlightFeature(feature, sourceCRS, title, options);
};

/**
 * Clear graphics from the MapLibre map
 */
export const clearGraphics = (
  map: MapLibreMap,
  title?: string
) => {
  if (!map) return;
  const provider = createHighlightProvider(map);
  provider.clearGraphics(title);
};

/**
 * Create a pin marker on the MapLibre map
 */
export function createPinGraphic(
  lat: number,
  long: number,
  map: MapLibreMap
) {
  if (!map) return;
  const provider = createHighlightProvider(map);
  provider.createPinGraphic(lat, long);
}
