import { MapImageLayerRenderer, RegularLayerRenderer } from '@/lib/types/mapping-types';

/**
 * Unified return type for legend data from both implementations
 * Can be a single renderer or an array of renderers
 */
export type RendererData = (MapImageLayerRenderer | RegularLayerRenderer)[] | undefined;

/**
 * Base interface for legend providers
 * MapLibre implementation provides renderer/legend data for layers
 */
export interface LegendProvider {
  /**
   * Get renderer/legend data for a specific layer
   * @param layerId - The ID of the layer
   * @param fallbackWmsUrl - Optional fallback WMS URL if layer metadata not available
   * @param fallbackLayerName - Optional fallback layer name if layer metadata not available
   * @returns Promise resolving to renderer data or undefined
   */
  getRenderer(layerId: string, fallbackWmsUrl?: string, fallbackLayerName?: string): Promise<RendererData>;
}

