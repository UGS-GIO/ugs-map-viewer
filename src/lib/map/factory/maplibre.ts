import maplibregl from 'maplibre-gl';
import { LayerSpecification, RasterSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import { LayerProps, WMSLayerProps, GroupLayerProps } from '@/lib/types/mapping-types';
import { MapFactory, MapInitOptions, MapInitResult } from './types';
import { DEFAULT_BASEMAP } from '@/lib/basemaps';

function hasStringSource(layer: unknown): layer is { source: string } {
  return (
    typeof layer === 'object' &&
    layer !== null &&
    'source' in layer &&
    typeof layer.source === 'string'
  );
}

function hasRasterPaint(layer: unknown): layer is { paint?: { 'raster-opacity'?: number } } {
  return (
    typeof layer === 'object' &&
    layer !== null &&
    'paint' in layer &&
    (layer.paint === undefined || typeof layer.paint === 'object')
  );
}

interface RasterSourceWithMetadata extends RasterSourceSpecification {
  metadata?: Record<string, unknown>;
}

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

  /**
   * Refresh a WMS layer by removing and re-adding its source
   * This forces MapLibre to re-request all tiles from the WMS server
   */
  refreshWMSLayer(mapInstance: maplibregl.Map, title: string): void {
    // Find the layer by title
    const layer = this.findLayerByTitle(mapInstance, title);
    if (!layer) {
      console.warn(`[refreshWMSLayer] Layer not found: ${title}`);
      return;
    }

    // Check if this is a raster layer
    if (layer.type !== 'raster') {
      console.warn(`[refreshWMSLayer] Layer is not a raster layer: ${title}`);
      return;
    }

    const layerId = layer.id;

    if (!hasStringSource(layer)) {
      console.warn(`[refreshWMSLayer] Invalid source for layer: ${title}`);
      return;
    }

    const sourceId = layer.source;

    // Get the current source configuration
    const source = mapInstance.getSource(sourceId);
    if (!source || source.type !== 'raster') {
      console.warn(`[refreshWMSLayer] Source not found or not a raster source: ${sourceId}`);
      return;
    }

    // Preserve current layer visibility
    const visibility = layer.layout?.visibility || 'visible';

    let opacity = 1;
    if (hasRasterPaint(layer) && layer.paint && 'raster-opacity' in layer.paint) {
      const paintOpacity = layer.paint['raster-opacity'];
      if (typeof paintOpacity === 'number') {
        opacity = paintOpacity;
      }
    }

    // Get source configuration from the serialized source
    const serialized = source.serialize();
    if (!serialized || typeof serialized !== 'object') {
      console.warn(`[refreshWMSLayer] Failed to serialize source: ${sourceId}`);
      return;
    }

    const sourceConfig = serialized as RasterSourceSpecification;

    // Remove and re-add the layer and source
    try {
      mapInstance.removeLayer(layerId);
      mapInstance.removeSource(sourceId);

      // Re-add source with cache-busting timestamp
      const tiles = sourceConfig.tiles?.map((tileUrl) => {
        const separator = tileUrl.includes('?') ? '&' : '?';
        return `${tileUrl}${separator}_t=${Date.now()}`;
      });

      mapInstance.addSource(sourceId, {
        ...sourceConfig,
        tiles: tiles || sourceConfig.tiles,
      });

      // Re-add layer with preserved settings
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        layout: {
          visibility: visibility,
        },
        paint: {
          'raster-opacity': opacity,
        },
        metadata: layer.metadata,
      });

      console.log(`[refreshWMSLayer] ✓ Refreshed layer: ${title}`);
    } catch (error) {
      console.error(`[refreshWMSLayer] Error refreshing layer ${title}:`, error);
    }
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
      style: DEFAULT_BASEMAP.url,
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
    // Use larger tile size and buffer to prevent symbol clipping
    const params = new URLSearchParams({
      service: 'WMS',
      version: '1.1.0',
      request: 'GetMap',
      layers: sublayerName,
      styles: '',
      srs: 'EPSG:3857',
      width: '512',  // Larger tiles to reduce seams
      height: '512',
      format: 'image/png',
      transparent: 'true',
      // GeoServer vendor parameters to handle symbol overlap
      buffer: '32',  // Buffer around tiles for symbols that cross boundaries
    });

    // Add any custom parameters (including filters)
    if (layerConfig.customLayerParameters) {
      for (const [key, value] of Object.entries(layerConfig.customLayerParameters)) {
        if (value !== null && value !== undefined) {
          params.set(key.toLowerCase(), String(value));
        }
      }
    }

    const baseUrl = layerConfig.url.replace(/\/$/, ''); // Remove trailing slash if present
    const sourceUrl = `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`;

    // Remove existing source and layer if they exist (for refresh)
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    // Add source with proper scheme
    const sourceSpec: RasterSourceWithMetadata = {
      type: 'raster',
      tiles: [sourceUrl],
      tileSize: 512,  // Match the tile size in the request
      scheme: 'xyz', // Use xyz scheme for standard WMS
      minzoom: 0,
      maxzoom: 22,
      metadata: {
        'wms-layer': sublayerName,
        'wms-url': baseUrl,
        'custom-parameters': layerConfig.customLayerParameters,
      },
    };
    map.addSource(sourceId, sourceSpec);

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
