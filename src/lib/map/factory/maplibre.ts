import maplibregl from 'maplibre-gl';
import { LayerSpecification, RasterSourceSpecification } from '@maplibre/maplibre-gl-style-spec';
import { LayerProps, WMSLayerProps, GroupLayerProps, PMTilesLayerProps, WFSLayerProps } from '@/lib/types/mapping-types';
import { MapFactory, MapInitOptions, MapInitResult } from './types';
import { DEFAULT_BASEMAP } from '@/lib/basemaps';
import { setupPMTilesProtocol } from '@/lib/map/pmtiles/setup';
import { FeatureCollection, Geometry } from 'geojson';

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
  private _lastDOMExceptionLog?: number;

  async init(
    container: HTMLDivElement,
    _isMobile: boolean,
    options: MapInitOptions,
    layers: LayerProps[],
    _initialView?: 'map' | 'scene'
  ): Promise<MapInitResult> {
    // Set up PMTiles protocol before creating map
    setupPMTilesProtocol();

    const map = this.createMap(container, options);

    // Add error handling for tile loading failures and source errors
    map.on('error', (e) => {
      // Log but don't crash on tile loading errors
      const error = e.error;
      const message = error?.message || '';
      const errorName = error?.name || '';

      // DOMException with "not, or is no longer, usable" is typically from:
      // - ImageBitmap that's been closed
      // - ArrayBuffer that's been detached
      // - Worker that's been terminated
      // This happens during tile decoding - log but don't spam console
      if (errorName === 'DOMException' && message.includes('no longer')) {
        // Only log once per second to avoid console spam
        const now = Date.now();
        if (!this._lastDOMExceptionLog || now - this._lastDOMExceptionLog > 1000) {
          this._lastDOMExceptionLog = now;
          console.warn('[MapLibre] Tile decode error (ImageBitmap closed) - this may indicate a MapLibre/browser compatibility issue');
        }
        return;
      }

      // Categorize other errors for debugging
      if (message.includes('tile') || message.includes('Tile')) {
        console.warn('[MapLibre] Tile loading error (non-fatal):', message);
      } else if (message.includes('source') || message.includes('Source')) {
        console.warn('[MapLibre] Source error (non-fatal):', message);
      } else if (message.includes('style') || message.includes('Style')) {
        console.error('[MapLibre] Style error:', message);
      } else {
        console.error('[MapLibre] Map error:', error);
      }
    });

    // Handle source-specific data loading events
    map.on('sourcedata', (e) => {
      if (e.sourceId && e.isSourceLoaded === false && e.dataType === 'source') {
        // Source is loading - this is normal
      }
    });

    map.on('sourcedataabort', (e) => {
      console.warn('[MapLibre] Source data loading aborted:', e.sourceId);
    });

    // Handle WebGL context lost - this is the likely cause of DOMExceptions
    const canvas = map.getCanvas();
    canvas.addEventListener('webglcontextlost', (event) => {
      console.error('[MapLibre] WebGL context lost - map will become unresponsive');
      event.preventDefault(); // Allows context to be restored
    });

    canvas.addEventListener('webglcontextrestored', () => {
      // Trigger a repaint to recover
      map.triggerRepaint();
    });

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
    // Determine if basemap URL is a raster tile pattern or vector style JSON
    const basemapUrl = DEFAULT_BASEMAP.url;
    const isRasterTiles = basemapUrl.includes('{z}') && basemapUrl.includes('{x}') && basemapUrl.includes('{y}');

    let style: maplibregl.StyleSpecification | string;

    if (!basemapUrl) {
      // No basemap - empty style
      style = {
        version: 8,
        sources: {},
        layers: [],
      };
    } else if (isRasterTiles) {
      // Raster tile URL pattern - create a raster style
      style = {
        version: 8,
        sources: {
          'basemap': {
            type: 'raster',
            tiles: [basemapUrl],
            tileSize: 256,
            attribution: '© <a href="https://gis.utah.gov">UGRC</a>',
          },
        },
        layers: [
          {
            id: 'basemap',
            type: 'raster',
            source: 'basemap',
          },
        ],
      };
    } else {
      // Vector style JSON URL
      style = basemapUrl;
    }

    return new maplibregl.Map({
      container,
      style,
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
    } else if (layerConfig.type === 'pmtiles') {
      await this.addPMTilesLayer(map, layerConfig as PMTilesLayerProps);
    } else if (layerConfig.type === 'wfs') {
      await this.addWFSLayer(map, layerConfig as WFSLayerProps);
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

  private async addPMTilesLayer(map: maplibregl.Map, layerConfig: PMTilesLayerProps): Promise<void> {
    const sourceId = `pmtiles-${layerConfig.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();

    // Build PMTiles URL - pmtiles:// protocol expects full HTTP URL after the prefix
    let pmtilesUrl: string;
    if (layerConfig.pmtilesUrl.startsWith('http')) {
      pmtilesUrl = `pmtiles://${layerConfig.pmtilesUrl}`;
    } else {
      pmtilesUrl = `pmtiles://${window.location.origin}${layerConfig.pmtilesUrl}`;
    }

    // Add vector source with PMTiles protocol - use url: format as per official docs
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'vector',
        url: pmtilesUrl,
      });
    }

    // If styleUrl is provided, fetch and apply the style layers
    if (layerConfig.styleUrl) {
      try {
        const response = await fetch(layerConfig.styleUrl);
        if (!response.ok) {
          console.error(`[addPMTilesLayer] Style fetch failed for ${layerConfig.title}:`, response.status);
          return;
        }
        const styleJson = await response.json();

        // Filter style layers to only those matching this config's sourceLayer
        // This is important for combined PMTiles where one style JSON contains all layers
        const matchingLayers = (styleJson.layers || []).filter((layer: Record<string, unknown>) => {
          return layer['source-layer'] === layerConfig.sourceLayer;
        });

        // Add each matching layer from the style, updating source references
        for (const layer of matchingLayers) {
          const layerId = `${sourceId}-${layer.id}`;

          if (!map.getLayer(layerId)) {
            try {
              const layerSpec: maplibregl.LayerSpecification = {
                id: layerId,
                type: layer.type,
                source: sourceId,
                'source-layer': layer['source-layer'],
                ...(layer.filter && { filter: layer.filter }), // Only include filter if defined
                layout: {
                  ...layer.layout,
                  visibility: layerConfig.visible ? 'visible' : 'none',
                },
                paint: layer.paint || {},
                metadata: {
                  title: layerConfig.title,
                  pmtilesLayer: true,
                  maplibreStyleUrl: layerConfig.styleUrl,
                  maplibreSourceId: sourceId,
                  maplibreSourceLayer: layerConfig.sourceLayer,
                },
              };

              map.addLayer(layerSpec);
            } catch (err) {
              console.error(`[addPMTilesLayer] Failed to add layer ${layerId}:`, err);
            }
          }
        }
      } catch (error) {
        console.error(`[addPMTilesLayer] Error loading style for ${layerConfig.title}:`, error);
      }
    } else {
      // Default fill + line style if no styleUrl provided
      const fillLayerId = `${sourceId}-fill`;
      const lineLayerId = `${sourceId}-line`;

      if (!map.getLayer(fillLayerId)) {
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          'source-layer': layerConfig.sourceLayer,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'fill-color': '#088',
            'fill-opacity': layerConfig.opacity || 0.5,
          },
          metadata: {
            title: layerConfig.title,
            pmtilesLayer: true,
            maplibreSourceId: sourceId,
            maplibreSourceLayer: layerConfig.sourceLayer,
          },
        });
      }

      if (!map.getLayer(lineLayerId)) {
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          'source-layer': layerConfig.sourceLayer,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'line-color': '#333',
            'line-width': 1,
          },
          metadata: {
            title: layerConfig.title,
            pmtilesLayer: true,
            maplibreSourceId: sourceId,
            maplibreSourceLayer: layerConfig.sourceLayer,
          },
        });
      }
    }
  }
  /**
   * Fetch GeoJSON from a WFS service and add as vector layer
   * Uses queryRenderedFeatures for click detection (respects symbol bounds)
   */
  private async addWFSLayer(map: maplibregl.Map, layerConfig: WFSLayerProps): Promise<void> {
    const sourceId = `wfs-${layerConfig.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();

    // Build WFS GetFeature URL
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: layerConfig.typeName,
      outputFormat: 'application/json',
      srsName: layerConfig.crs || 'EPSG:4326',
    });

    const wfsUrl = `${layerConfig.wfsUrl}?${params.toString()}`;

    try {
      const response = await fetch(wfsUrl);
      if (!response.ok) {
        console.error(`[addWFSLayer] WFS fetch failed for ${layerConfig.title}:`, response.status);
        return;
      }

      const geojson: FeatureCollection<Geometry> = await response.json();

      if (!geojson.features || geojson.features.length === 0) {
        console.warn(`[addWFSLayer] No features returned for ${layerConfig.title}`);
      }

      // Detect geometry type from first feature if not specified
      let geometryType = layerConfig.geometryType;
      if (!geometryType && geojson.features.length > 0) {
        const firstGeomType = geojson.features[0].geometry?.type;
        if (firstGeomType === 'Point' || firstGeomType === 'MultiPoint') {
          geometryType = 'point';
        } else if (firstGeomType === 'LineString' || firstGeomType === 'MultiLineString') {
          geometryType = 'line';
        } else {
          geometryType = 'polygon';
        }
      }

      // Remove existing source if it exists (for refresh)
      const style = map.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          if (layer.id.startsWith(sourceId)) {
            map.removeLayer(layer.id);
          }
        }
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Add GeoJSON source
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
      });

      const styleConfig = layerConfig.style || {};

      // Add appropriate layer(s) based on geometry type
      if (geometryType === 'point') {
        const circleLayerId = `${sourceId}-circle`;

        // Build circle-radius: either data-driven or static
        // Use min/max to clamp (like SLD Interpolate) so values beyond stops don't extrapolate
        let circleRadius: number | maplibregl.ExpressionSpecification = styleConfig.circleRadius || 6;
        if (styleConfig.circleRadiusProperty) {
          const { field, stops } = styleConfig.circleRadiusProperty;
          const [minVal, minRadius, maxVal, maxRadius] = stops;
          // Use coalesce to provide a fallback value for null/missing properties
          // This ensures the interpolate expression always receives a valid number
          circleRadius = [
            'min', maxRadius,
            ['max', minRadius,
              ['interpolate',
                ['linear'],
                ['coalesce', ['get', field], minVal], // fallback to minVal if null
                minVal, minRadius,
                maxVal, maxRadius
              ]
            ]
          ];
        }

        // Build circle-color: either data-driven or static
        let circleColor: string | maplibregl.ExpressionSpecification = styleConfig.circleColor || '#088';
        if (styleConfig.circleColorProperty) {
          const { field, stops, defaultColor } = styleConfig.circleColorProperty;
          // Use coalesce to provide a fallback value for null/missing properties
          // This ensures the step expression always receives a valid number
          // Using -Infinity as fallback ensures defaultColor is used (before first stop)
          circleColor = ['step',
            ['coalesce', ['get', field], -Infinity],
            defaultColor,
            ...stops.flat()
          ];
        }

        map.addLayer({
          id: circleLayerId,
          type: 'circle',
          source: sourceId,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'circle-radius': circleRadius,
            'circle-color': circleColor,
            'circle-stroke-color': styleConfig.circleStrokeColor || '#fff',
            'circle-stroke-width': styleConfig.circleStrokeWidth || 1,
            'circle-opacity': layerConfig.opacity || 1,
          },
          metadata: {
            title: layerConfig.title,
            wfsLayer: true,
            wfsTypeName: layerConfig.typeName,
            wfsSourceId: sourceId,
            // WMS metadata for legend fetching
            wmsUrl: layerConfig.wfsUrl.replace('/wfs', '/wms'),
            wmsLayerName: layerConfig.typeName,
          },
        });
      } else if (geometryType === 'line') {
        const lineLayerId = `${sourceId}-line`;
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'line-color': styleConfig.lineColor || '#088',
            'line-width': styleConfig.lineWidth || 2,
            'line-opacity': layerConfig.opacity || 1,
          },
          metadata: {
            title: layerConfig.title,
            wfsLayer: true,
            wfsTypeName: layerConfig.typeName,
            wfsSourceId: sourceId,
          },
        });
      } else {
        // Polygon - add fill and outline
        const fillLayerId = `${sourceId}-fill`;
        const outlineLayerId = `${sourceId}-outline`;

        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'fill-color': styleConfig.fillColor || '#088',
            'fill-opacity': (layerConfig.opacity || 0.5) * 0.5, // More transparent fill
          },
          metadata: {
            title: layerConfig.title,
            wfsLayer: true,
            wfsTypeName: layerConfig.typeName,
            wfsSourceId: sourceId,
          },
        });

        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          layout: {
            visibility: layerConfig.visible ? 'visible' : 'none',
          },
          paint: {
            'line-color': styleConfig.lineColor || '#333',
            'line-width': styleConfig.lineWidth || 1,
          },
          metadata: {
            title: layerConfig.title,
            wfsLayer: true,
            wfsTypeName: layerConfig.typeName,
            wfsSourceId: sourceId,
          },
        });
      }

    } catch (error) {
      console.error(`[addWFSLayer] Error loading WFS layer ${layerConfig.title}:`, error);
    }
  }
}
// PMTiles support added - uses pmtiles:// protocol with url: format
// WFS support added - fetches GeoJSON and uses queryRenderedFeatures for clicks
