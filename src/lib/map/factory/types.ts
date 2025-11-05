import { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { LayerProps } from '@/lib/types/mapping-types';

/**
 * Map initialization options
 */
export interface MapInitOptions {
  zoom: number;
  center: [number, number];
}

/**
 * Map initialization result (MapLibre GL JS)
 */
export interface MapInitResult {
  map: maplibregl.Map;
}

/**
 * MapLibre GL JS factory interface
 */
export interface MapFactory {
  /**
   * Initialize a map instance in the given container
   */
  init(
    container: HTMLDivElement,
    isMobile: boolean,
    options: MapInitOptions,
    layers: LayerProps[],
    initialView?: 'map' | 'scene'
  ): Promise<MapInitResult>;

  /**
   * Find a layer by title
   */
  findLayerByTitle(mapInstance: maplibregl.Map, title: string): LayerSpecification | null;

  /**
   * Add layers to the map
   */
  addLayersToMap(mapInstance: maplibregl.Map, layersConfig: LayerProps[]): Promise<void>;
}
