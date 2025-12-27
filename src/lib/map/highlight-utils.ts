import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { createHighlightProvider } from './highlight/factory';
import type { HighlightOptions } from './highlight/types';
import type { MapLibreMap } from '@/lib/types/map-types';
import { MapLibreHighlight } from './highlight/maplibre';

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
 * Highlight multiple features efficiently (single source/layer instead of many)
 */
export const highlightFeatureCollection = (
  features: Feature<Geometry, GeoJsonProperties>[],
  map: MapLibreMap,
  sourceCRS: string,
  title: string,
  options?: HighlightOptions
): boolean => {
  const provider = createHighlightProvider(map) as MapLibreHighlight;
  return provider.highlightFeatureCollection(features, sourceCRS, title, options);
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

/**
 * Feature-like object with optional geometry (e.g., ClickedFeature)
 */
interface FeatureLike {
  id: string | number
  geometry?: Geometry
  properties?: Record<string, unknown>
  layerTitle?: string
}

/**
 * Highlight multiple feature-like objects, filtering out those without geometry
 * Converts to proper GeoJSON Features and uses efficient batch highlighting
 */
export function highlightClickedFeatures(
  features: FeatureLike[],
  map: MapLibreMap,
  sourceCRS: string = 'EPSG:4326'
): boolean {
  if (!map || features.length === 0) return false

  const geoJsonFeatures: Feature<Geometry, GeoJsonProperties>[] = features
    .filter((f): f is FeatureLike & { geometry: Geometry } => !!f.geometry)
    .map(f => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: f.geometry,
      properties: f.properties || {},
    }))

  if (geoJsonFeatures.length === 0) return false

  // Use first feature's layer title or generic title
  const title = features[0]?.layerTitle || 'highlight'
  return highlightFeatureCollection(geoJsonFeatures, map, sourceCRS, title)
}
