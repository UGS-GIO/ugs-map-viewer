import { LayerProps, layerTypeMapping, LayerConstructor, GroupLayerProps, WMSLayerProps } from '@/lib/types/mapping-types';
import { convertBbox } from '@/lib/map/conversion-utils';
import { ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import { MapFactory, MapInitOptions, MapInitResult } from './types';

let appView: __esri.MapView | __esri.SceneView | undefined;

/**
 * ArcGIS-specific map factory
 * Handles map and view initialization using ArcGIS SDK
 *
 * Note: ArcGIS imports are dynamically required within methods to avoid
 * CSS import errors in test environments
 */
export class ArcGISMapFactory implements MapFactory {
  async init(
    container: HTMLDivElement,
    isMobile: boolean,
    options: MapInitOptions,
    layers: LayerProps[],
    initialView?: 'map' | 'scene'
  ): Promise<MapInitResult> {
    if (appView) {
      appView.destroy();
    }

    const map = this.createMap();
    const view = this.createView(container, map, initialView, isMobile, options);
    await this.addLayersToMap(map, layers);

    appView = view;
    return { map, view };
  }

  findLayerByTitle(mapInstance: __esri.Map, title: string): __esri.Layer | null {
    let foundLayer: __esri.Layer | null = null;

    mapInstance.layers.forEach(layer => {
      if (layer.title === title) {
        foundLayer = layer;
      } else if (layer.type === 'group') {
        const groupLayer = layer as __esri.GroupLayer;
        const subLayer = groupLayer.layers.find(childLayer => childLayer.title === title);
        if (subLayer) {
          foundLayer = subLayer;
        }
      }
    });

    return foundLayer;
  }

  async addLayersToMap(mapInstance: __esri.Map, layersConfig: LayerProps[]): Promise<void> {
    const createdLayers: __esri.Layer[] = [];

    for (const layer of layersConfig) {
      const createdLayer = this.createLayer(layer) as __esri.Layer;
      if (createdLayer) {
        createdLayers.push(createdLayer);
      }
    }

    if (createdLayers.length > 0) {
      mapInstance.addMany(createdLayers.reverse());
    }
  }

  private createMap(): __esri.Map {
    const Map = require('@arcgis/core/Map').default;
    const { basemapList } = require('@/components/top-nav');

    return new Map({
      basemap: basemapList.find((item: any) => item.isActive)?.basemapStyle,
    });
  }

  private createView(
    container: HTMLDivElement,
    map: __esri.Map,
    viewType: 'map' | 'scene' = 'scene',
    _isMobile: boolean,
    initialView: MapInitOptions
  ): __esri.MapView | __esri.SceneView {
    const SceneView = require('@arcgis/core/views/SceneView').default;
    const MapView = require('@arcgis/core/views/MapView').default;

    const commonOptions = {
      container,
      map,
      zoom: initialView.zoom,
      center: initialView.center,
      ui: {
        components: ['zoom', 'compass', 'attribution'],
      },
    };

    return viewType === 'scene'
      ? new SceneView(commonOptions)
      : new MapView(commonOptions);
  }

  private createLayer(layer: LayerProps): __esri.Layer | undefined {
    if (layer.type === 'group') {
      const GroupLayer = require('@arcgis/core/layers/GroupLayer').default;
      const typedLayer = layer as GroupLayerProps;
      const groupLayers = typedLayer.layers
        ?.map(l => this.createLayer(l))
        .filter(l => l !== undefined)
        .reverse() as __esri.CollectionProperties<__esri.Layer> | undefined;

      return new GroupLayer({
        title: layer.title,
        visible: layer.visible,
        layers: groupLayers,
      });
    }

    const LayerType = layerTypeMapping[layer.type];

    if (LayerType) {
      return this.createLayerFromUrl(layer, LayerType);
    }

    console.warn(`unsupported layer type: ${layer.type}`);
    return undefined;
  }

  private createLayerFromUrl(layer: LayerProps, LayerType: LayerConstructor): __esri.Layer | undefined {
    if (!LayerType) {
      console.warn(`unsupported layer type: ${layer.type}`);
      return undefined;
    }

    if (layer.type === 'wms') {
      const typedLayer = layer as WMSLayerProps;
      return new LayerType({
        url: typedLayer.url,
        title: typedLayer.title,
        visible: typedLayer.visible,
        sublayers: typedLayer.sublayers,
        opacity: layer.opacity,
        customLayerParameters: typedLayer.customLayerParameters,
      });
    }

    if (layer.url) {
      return new LayerType({
        url: layer.url,
        title: layer.title,
        visible: layer.visible,
        opacity: layer.opacity,
        ...layer.options,
      });
    }

    console.warn(`missing url in layer props: ${JSON.stringify(layer)}`);
    return undefined;
  }
}

/**
 * Zoom to a feature bounding box
 * @deprecated Use ArcGISMapFactory directly
 */
export function zoomToFeature(
  feature: ExtendedFeature,
  view: __esri.MapView | __esri.SceneView,
  sourceCRS: string
): void {
  if (feature.bbox) {
    const Extent = require('@arcgis/core/geometry/Extent').default;
    const bbox = convertBbox(feature.bbox, sourceCRS);

    view?.goTo({
      target: new Extent({
        xmin: bbox[0],
        ymin: bbox[1],
        xmax: bbox[2],
        ymax: bbox[3],
        spatialReference: { wkid: 4326 }
      })
    });
  }
}
