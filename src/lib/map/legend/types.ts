import { MapImageLayerRenderer, RegularLayerRenderer } from '@/lib/types/mapping-types';

/**
 * Unified return type for legend data from both implementations
 * Can be a single renderer or an array of renderers
 */
export type RendererData = (MapImageLayerRenderer | RegularLayerRenderer)[] | undefined;

/**
 * Base interface for legend providers
 * Both ArcGIS and MapLibre implementations must conform to this interface
 */
export interface LegendProvider {
  /**
   * Get renderer/legend data for a specific layer
   * @param layerId - The ID of the layer
   * @returns Promise resolving to renderer data or undefined
   */
  getRenderer(layerId: string): Promise<RendererData>;
}

