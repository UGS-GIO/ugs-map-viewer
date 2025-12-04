import maplibregl from 'maplibre-gl';
import { MapLibreLegend } from './maplibre';
import { LegendProvider } from './types';

/**
 * Creates a MapLibre GL JS legend provider
 * @param maplibreMap - MapLibre map instance
 */
export function createLegendProvider(maplibreMap: maplibregl.Map): LegendProvider {
  if (!maplibreMap) {
    throw new Error('MapLibre map instance is required');
  }
  return new MapLibreLegend(maplibreMap);
}

/**
 * Re-export the types for convenience
 */
export type { LegendProvider, RendererData } from './types';
export { MapLibreLegend };
