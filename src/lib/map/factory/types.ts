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
 * Map initialization result
 * map: ArcGIS Map or MapLibre Map instance
 * view: ArcGIS MapView/SceneView (not used for MapLibre)
 */
export interface MapInitResult {
  map: __esri.Map | maplibregl.Map;
  view?: __esri.MapView | __esri.SceneView;
}

/**
 * Base interface for map factory providers
 * Both ArcGIS and MapLibre implementations must conform to this interface
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
   * Returns layer object specific to implementation (ArcGIS Layer or MapLibre LayerSpecification)
   */
  findLayerByTitle(mapInstance: __esri.Map | maplibregl.Map, title: string): __esri.Layer | LayerSpecification | null;

  /**
   * Add layers to the map
   */
  addLayersToMap(mapInstance: __esri.Map | maplibregl.Map, layersConfig: LayerProps[]): Promise<void>;
}
