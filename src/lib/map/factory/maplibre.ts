import maplibregl from 'maplibre-gl';
import { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { LayerProps, WMSLayerProps, GroupLayerProps } from '@/lib/types/mapping-types';
import { MapFactory, MapInitOptions, MapInitResult } from './types';

/**
 * MapLibre-specific map factory
 * Handles map initialization using MapLibre GL JS
 */
export class MapLibreMapFactory implements MapFactory {
  async init(
    container: HTMLDivElement,
    _isMobile: boolean,
    options: MapInitOptions,
    layers: LayerProps[],
    _initialView?: 'map' | 'scene'
  ): Promise<MapInitResult> {
    const map = this.createMap(container, options);

    // Wait for style to load before adding layers
    if (!map.isStyleLoaded()) {
      await new Promise<void>(resolve => {
        map.on('style.load', () => resolve());
      });
    }

    await this.addLayersToMap(map, layers);

    return { map };
  }

  findLayerByTitle(mapInstance: maplibregl.Map, title: string): LayerSpecification | null {
    const style = mapInstance.getStyle();
    if (!style) return null;

    for (const layer of style.layers || []) {
      if (this.getLayerTitle(layer) === title) {
        return layer;
      }
    }

    return null;
  }

  private getLayerTitle(layer: LayerSpecification): string | undefined {
    const metadata = layer.metadata;
    if (metadata && typeof metadata === 'object' && 'title' in metadata) {
      return (metadata as Record<string, unknown>).title as string | undefined;
    }
    return undefined;
  }

  private getFirstSublayerName(sublayers: unknown): string {
    if (!sublayers) {
      return '';
    }
    const items = Array.isArray(sublayers)
      ? sublayers
      : (typeof sublayers === 'object' && 'length' in sublayers ? Array.from(sublayers as ArrayLike<unknown>) : []);

    if (items.length === 0) {
      return '';
    }
    const firstSublayer = items[0];
    if (typeof firstSublayer === 'object' && firstSublayer !== null && 'name' in firstSublayer) {
      return (firstSublayer as Record<string, unknown>).name as string || '';
    }
    return '';
  }

  async addLayersToMap(mapInstance: maplibregl.Map, layersConfig: LayerProps[]): Promise<void> {
    for (const layerConfig of layersConfig) {
      await this.addLayer(mapInstance, layerConfig);
    }
  }

  private createMap(
    container: HTMLDivElement,
    options: MapInitOptions
  ): maplibregl.Map {
    return new maplibregl.Map({
      container,
      style: 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json',
      center: [options.center[0], options.center[1]],
      zoom: options.zoom,
    });
  }

  private async addLayer(map: maplibregl.Map, layerConfig: LayerProps): Promise<void> {
    if (layerConfig.type === 'group') {
      const groupConfig = layerConfig as GroupLayerProps;
      if (groupConfig.layers) {
        for (const childLayer of groupConfig.layers) {
          await this.addLayer(map, childLayer);
        }
      }
      return;
    }

    if (layerConfig.type === 'wms') {
      await this.addWMSLayer(map, layerConfig as WMSLayerProps);
    } else if (layerConfig.url) {
      await this.addMapImageLayer(map, layerConfig);
    }
  }

  private async addWMSLayer(map: maplibregl.Map, layerConfig: WMSLayerProps): Promise<void> {
    if (!layerConfig.url) return;

    const sourceId = `wms-${layerConfig.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
    const layerId = `wms-layer-${sourceId}`;

    const sublayerName = this.getFirstSublayerName(layerConfig.sublayers);

    // Build WMS GetMap URL with dynamic bbox for tile requests
    // MapLibre will replace {bbox-epsg-3857} with the actual tile bounds
    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.1.0',
      request: 'GetMap',
      layers: sublayerName,
      styles: '',
      srs: 'EPSG:3857',
      width: '256',
      height: '256',
      format: 'image/png',
      transparent: 'true',
    });

    const baseUrl = layerConfig.url.replace(/\/$/, ''); // Remove trailing slash if present
    const sourceUrl = `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [sourceUrl],
        tileSize: 256,
        scheme: 'tms',
        metadata: {
          'wms-layer': sublayerName,
          'wms-url': baseUrl,
        },
      } as any);
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        layout: {
          visibility: layerConfig.visible ? 'visible' : 'none',
        },
        paint: {
          'raster-opacity': layerConfig.opacity || 1,
        },
        metadata: {
          title: layerConfig.title,
        },
      },
      undefined
      );
    }
  }

  private async addMapImageLayer(map: maplibregl.Map, layerConfig: LayerProps): Promise<void> {
    if (!layerConfig.url) return;

    const sourceId = `mapimage-${layerConfig.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
    const layerId = `mapimage-layer-${sourceId}`;

    // Build WMS GetMap URL with dynamic bbox for tile requests
    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.1.0',
      request: 'GetMap',
      layers: '0',
      styles: '',
      srs: 'EPSG:3857',
      width: '256',
      height: '256',
      format: 'image/png',
      transparent: 'true',
    });

    const baseUrl = layerConfig.url.replace(/\/$/, ''); // Remove trailing slash if present
    const sourceUrl = `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [sourceUrl],
        tileSize: 256,
        scheme: 'tms',
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        layout: {
          visibility: layerConfig.visible ? 'visible' : 'none',
        },
        paint: {
          'raster-opacity': layerConfig.opacity || 1,
        },
        metadata: {
          title: layerConfig.title,
        },
      },
      undefined
      );
    }
  }
}
