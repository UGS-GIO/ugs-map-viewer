import maplibregl from 'maplibre-gl';
import { MapLibreHighlight } from './maplibre';
import { HighlightProvider } from './types';

// Cache providers per map instance using WeakMap for automatic cleanup
const maplibreProviderCache = new WeakMap<maplibregl.Map, MapLibreHighlight>();

/**
 * Creates a MapLibre GL JS highlight provider
 * Caches provider instances per map to preserve highlight tracking
 *
 * @param map - MapLibre map instance
 */
export function createHighlightProvider(map: maplibregl.Map): HighlightProvider {
  if (!map) {
    throw new Error('MapLibre map instance is required');
  }

  // Reuse the same provider instance for this map to preserve highlight tracking
  let provider = maplibreProviderCache.get(map);
  if (!provider) {
    provider = new MapLibreHighlight(map);
    maplibreProviderCache.set(map, provider);
  }

  return provider;
}

export type { HighlightProvider, HighlightOptions } from './types';
export { MapLibreHighlight };
