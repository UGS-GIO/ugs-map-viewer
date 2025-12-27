import maplibregl from 'maplibre-gl';
import {
  LayerSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
  CircleLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { createSVGSymbol } from '@/lib/legend/symbol-generator';
import { Legend, LegendRule } from '@/lib/types/geoserver-types';
import { LegendProvider, RendererData } from './types';
import { RegularLayerRenderer, CompositeSymbolResult } from '@/lib/types/mapping-types';

// Types for simplified legend rendering parameters
interface FillLegendParams {
  color: string;
  opacity: number;
  outlineColor: string;
}

interface LineLegendParams {
  color: string;
  width: number;
  opacity: number;
  dasharray: number[] | null;
  cap: 'butt' | 'round' | 'square' | null;
}

interface CircleLegendParams {
  color: string;
  radius: number;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
}

interface SymbolLegendParams {
  iconColor: string;
  textColor: string;
}

// Types for MapLibre style JSON (external fetched styles)
interface StyleJsonFillLayer {
  id: string;
  type: 'fill';
  source?: string;
  paint?: {
    'fill-color'?: string;
    'fill-opacity'?: number;
    'fill-outline-color'?: string;
  };
}

interface StyleJsonLineLayer {
  id: string;
  type: 'line';
  source?: string;
  paint?: {
    'line-color'?: string;
    'line-width'?: number;
    'line-opacity'?: number;
    'line-dasharray'?: number[];
  };
  layout?: {
    'line-cap'?: 'butt' | 'round' | 'square';
  };
}

interface StyleJsonCircleLayer {
  id: string;
  type: 'circle';
  source?: string;
  paint?: {
    'circle-color'?: string;
    'circle-radius'?: number;
    'circle-opacity'?: number;
    'circle-stroke-color'?: string;
    'circle-stroke-width'?: number;
  };
}

interface StyleJsonSymbolLayer {
  id: string;
  type: 'symbol';
  source?: string;
  paint?: {
    'icon-color'?: string;
    'text-color'?: string;
  };
}

interface StyleJsonOtherLayer {
  id: string;
  type: 'raster' | 'background';
  source?: string;
}

type StyleJsonLayer = StyleJsonFillLayer | StyleJsonLineLayer | StyleJsonCircleLayer | StyleJsonSymbolLayer | StyleJsonOtherLayer;

interface GeoStylerRule {
  name: string;
  symbolizers?: string[][];
}

interface StyleJson {
  layers?: StyleJsonLayer[];
  metadata?: {
    'geostyler:ref'?: {
      rules?: GeoStylerRule[];
    };
  };
}

interface RasterSourceWithMetadata {
  tiles?: string[];
  metadata?: {
    'wms-url'?: string;
    'wms-layer'?: string;
  };
}

interface MaplibreStyleMetadata {
  maplibreStyleUrl: string;
  maplibreSourceId?: string;
  maplibreSourceLayer?: string;
}

// Type guards
function isStyleJson(data: object): data is StyleJson {
  return 'layers' in data || 'metadata' in data || Object.keys(data).length === 0;
}

function hasMaplibreStyleMetadata(metadata: object | null | undefined): metadata is MaplibreStyleMetadata {
  if (!metadata) return false;
  if (!('maplibreStyleUrl' in metadata)) return false;
  const url = metadata.maplibreStyleUrl;
  return typeof url === 'string';
}

function getStringFromMetadata(metadata: MaplibreStyleMetadata, key: 'maplibreSourceId' | 'maplibreSourceLayer'): string {
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

// Cache for fetched style JSON to avoid redundant network requests
const styleJsonCache = new Map<string, StyleJson>();


/**
 * MapLibre-specific legend provider
 * Uses MapLibre layer paint properties and WMS endpoints for legends
 */
export class MapLibreLegend implements LegendProvider {
  constructor(private map: maplibregl.Map) {}

  async getRenderer(layerId: string, fallbackWmsUrl?: string, fallbackLayerName?: string): Promise<RendererData> {
    const style = this.map.getStyle();
    if (!style) {
      return;
    }

    const layers = style.layers?.filter(layer => layer.id === layerId) || [];

    if (layers.length === 0) {
      // Layer not found in map - try fallback WMS legend if URL and layer name provided
      if (fallbackWmsUrl && fallbackLayerName) {
        return await this.getWMSLegendForLayer(fallbackWmsUrl, fallbackLayerName);
      }
      return;
    }

    const layer = layers[0];

    // Check if this is a layer with a MapLibre style URL (e.g., PMTiles)
    // Narrow layer.metadata (which is typed as unknown by MapLibre) to our interface
    if (typeof layer.metadata === 'object' && layer.metadata !== null) {
      const metadata = layer.metadata as Record<string, unknown>;

      // Check for WFS layer with WMS legend metadata
      if (metadata.wfsLayer && metadata.wmsUrl && metadata.wmsLayerName) {
        return await this.getWMSLegendForLayer(
          metadata.wmsUrl as string,
          metadata.wmsLayerName as string
        );
      }

      // Check for WMS layer metadata (from react-map-gl layers)
      if (metadata['wms-url'] && metadata['wms-layer']) {
        return await this.getWMSLegendForLayer(
          metadata['wms-url'] as string,
          metadata['wms-layer'] as string
        );
      }

      if (hasMaplibreStyleMetadata(metadata)) {
        return await this.getMapLibreStyleLegend(
          metadata.maplibreStyleUrl,
          getStringFromMetadata(metadata, 'maplibreSourceId'),
          getStringFromMetadata(metadata, 'maplibreSourceLayer')
        );
      }
    }

    if (!('source' in layer) || typeof layer.source !== 'string') {
      return this.getLegendFromMapLibreLayer(layer, layerId);
    }

    const sourceId = layer.source;
    const source = style.sources?.[sourceId];

    if (source && typeof source === 'object' && 'tiles' in source) {
      return await this.getWMSLegend(sourceId, source);
    }

    return this.getLegendFromMapLibreLayer(layer, layerId);
  }

  /**
   * Extract legend from a MapLibre layer specification (from current map style)
   */
  private getLegendFromMapLibreLayer(layer: LayerSpecification, layerId: string): RendererData {
    try {
      const sourceId = 'source' in layer && typeof layer.source === 'string' ? layer.source : '';
      const svg = this.createSymbolFromMapLibreLayer(layer);

      if (svg) {
        return [{
          type: 'regular-layer-renderer' as const,
          label: layer.id || 'Layer',
          renderer: svg,
          id: layerId,
          url: sourceId,
        }];
      }

      return undefined;
    } catch (error) {
      console.error('Error extracting legend from paint properties:', error);
      return;
    }
  }

  /**
   * Extract legend from a style JSON layer (from fetched style)
   */
  private getLegendFromStyleJsonLayer(
    layer: StyleJsonLayer,
    sourceId: string,
    styleUrl: string
  ): RegularLayerRenderer | null {
    const svg = this.createSymbolFromStyleJsonLayer(layer);
    if (svg) {
      // Check for metadata.label first (added by pipeline from SLD rule titles)
      const layerWithMetadata = layer as {
        filter?: unknown[];
        'source-layer'?: string;
        metadata?: { label?: string };
      };

      let label: string;

      if (layerWithMetadata.metadata?.label) {
        // Use label from style JSON metadata (best source - from SLD rule titles)
        label = layerWithMetadata.metadata.label;
      } else {
        // Fallback: use source-layer name or filter values
        const sourceLayer = layerWithMetadata['source-layer'] || '';
        label = this.formatSourceLayerName(sourceLayer) || layer.id || 'Layer';

        if (layerWithMetadata.filter && Array.isArray(layerWithMetadata.filter)) {
          const filterInfo = this.extractFilterInfo(layerWithMetadata.filter);
          if (filterInfo.length > 0) {
            label = filterInfo.map(f => f.value).join(', ');
          }
        }
      }

      return {
        type: 'regular-layer-renderer' as const,
        label,
        renderer: svg,
        id: sourceId,
        url: styleUrl,
      };
    }
    return null;
  }

  /**
   * Format source-layer name for display (e.g., "karstfeatures_current" -> "Karst Features")
   */
  private formatSourceLayerName(sourceLayer: string): string {
    if (!sourceLayer) return '';
    // Remove _current suffix and convert to title case
    return sourceLayer
      .replace(/_current$/, '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Handle camelCase
      .replace(/\b\w/g, c => c.toUpperCase());  // Title case
  }

  /**
   * Extract filter info from a MapLibre filter expression
   * Returns { field, value } pairs for building relate_id lookup
   */
  private extractFilterInfo(filter: unknown[]): { field: string; value: string }[] {
    if (filter.length === 0) return [];

    const op = filter[0];

    // Simple filter: ["==", "field", "value"]
    if (op === '==' && filter.length >= 3) {
      const field = filter[1];
      const value = filter[2];
      if (typeof field === 'string' && typeof value === 'string') {
        return [{ field, value }];
      }
    }

    // Compound filter: ["all", [...], [...]] or ["any", [...], [...]]
    if ((op === 'all' || op === 'any') && filter.length > 1) {
      const results: { field: string; value: string }[] = [];
      for (let i = 1; i < filter.length; i++) {
        const subFilter = filter[i];
        if (Array.isArray(subFilter) && subFilter[0] === '==' && subFilter.length >= 3) {
          const field = subFilter[1];
          const value = subFilter[2];
          if (typeof field === 'string' && typeof value === 'string') {
            results.push({ field, value });
          }
        }
      }
      return results;
    }

    return [];
  }

  /**
   * Build legend from MapLibre style JSON
   * Uses metadata.label for human-readable labels (added by pipeline from SLD rule titles)
   * Filters by sourceLayer when using combined PMTiles
   */
  private async getMapLibreStyleLegend(styleUrl: string, sourceId: string, sourceLayer?: string): Promise<RendererData> {
    try {
      // Check cache first
      let styleJson = styleJsonCache.get(styleUrl);

      if (!styleJson) {
        const response = await fetch(styleUrl);
        if (!response.ok) {
          return undefined;
        }
        const data: object = await response.json();
        if (!isStyleJson(data)) {
          return undefined;
        }
        styleJson = data;
        styleJsonCache.set(styleUrl, styleJson);
      }

      // Filter layers by source-layer if provided (for combined PMTiles)
      let layers = styleJson?.layers || [];

      if (sourceLayer) {
        layers = layers.filter(l => {
          const sl = (l as { 'source-layer'?: string })['source-layer'];
          return sl === sourceLayer;
        });
      }

      const geostylerRules = styleJson?.metadata?.['geostyler:ref']?.rules || [];

      // If we have geostyler rules, use them for labels
      if (geostylerRules.length > 0) {
        const previews: RegularLayerRenderer[] = [];

        for (const rule of geostylerRules) {
          const ruleName = rule.name || 'Unknown';
          // Get the first symbolizer layer ID for this rule
          const layerIds = rule.symbolizers?.[0] || [];
          const primaryLayerId = layerIds[0];

          if (!primaryLayerId) continue;

          // Find the layer in the style
          const layer = layers.find((l) => l.id === primaryLayerId);
          if (!layer) continue;

          const svg = this.createSymbolFromStyleJsonLayer(layer);
          if (svg) {
            previews.push({
              type: 'regular-layer-renderer' as const,
              label: ruleName,
              renderer: svg,
              id: sourceId,
              url: styleUrl,
            });
          }
        }

        return previews.length > 0 ? previews : undefined;
      }

      // Fallback: create legend items from all layers
      const previews: RegularLayerRenderer[] = [];
      const seenLabels = new Set<string>();
      for (const layer of layers) {
        const item = this.getLegendFromStyleJsonLayer(layer, sourceId, styleUrl);
        if (item) {
          if (!seenLabels.has(item.label)) {
            seenLabels.add(item.label);
            previews.push(item);
          }
        }
      }

      return previews.length > 0 ? previews : undefined;
    } catch (error) {
      console.warn('[MapLibreLegend] Error building MapLibre style legend:', error);
      return undefined;
    }
  }

  /**
   * Extract legend params from a MapLibre FillLayerSpecification
   */
  private extractFillParams(layer: FillLayerSpecification): FillLegendParams {
    const paint = layer.paint;
    const color = paint?.['fill-color'];
    const opacity = paint?.['fill-opacity'];
    const outlineColor = paint?.['fill-outline-color'];
    return {
      color: typeof color === 'string' ? color : '#888',
      opacity: typeof opacity === 'number' ? opacity : 1,
      outlineColor: typeof outlineColor === 'string' ? outlineColor : '',
    };
  }

  /**
   * Extract legend params from a MapLibre LineLayerSpecification
   */
  private extractLineParams(layer: LineLayerSpecification): LineLegendParams {
    const paint = layer.paint;
    const layout = layer.layout;
    const color = paint?.['line-color'];
    const width = paint?.['line-width'];
    const opacity = paint?.['line-opacity'];
    const dasharray = paint?.['line-dasharray'];
    const cap = layout?.['line-cap'];

    // Build dasharray imperatively to ensure proper number[] type
    let numericDasharray: number[] | null = null;
    if (Array.isArray(dasharray)) {
      const numbers: number[] = [];
      for (const v of dasharray) {
        if (typeof v === 'number') {
          numbers.push(v);
        }
      }
      if (numbers.length > 0) {
        numericDasharray = numbers;
      }
    }

    return {
      color: typeof color === 'string' ? color : '#333',
      width: typeof width === 'number' ? width : 2,
      opacity: typeof opacity === 'number' ? opacity : 1,
      dasharray: numericDasharray,
      cap: cap === 'butt' || cap === 'round' || cap === 'square' ? cap : null,
    };
  }

  /**
   * Extract legend params from a MapLibre CircleLayerSpecification
   */
  private extractCircleParams(layer: CircleLayerSpecification): CircleLegendParams {
    const paint = layer.paint;
    const color = paint?.['circle-color'];
    const radius = paint?.['circle-radius'];
    const opacity = paint?.['circle-opacity'];
    const strokeColor = paint?.['circle-stroke-color'];
    const strokeWidth = paint?.['circle-stroke-width'];
    return {
      color: typeof color === 'string' ? color : '#888',
      radius: typeof radius === 'number' ? radius : 6,
      opacity: typeof opacity === 'number' ? opacity : 1,
      strokeColor: typeof strokeColor === 'string' ? strokeColor : '',
      strokeWidth: typeof strokeWidth === 'number' ? strokeWidth : 1,
    };
  }

  /**
   * Extract legend params from a MapLibre SymbolLayerSpecification
   */
  private extractSymbolParams(layer: SymbolLayerSpecification): SymbolLegendParams {
    const paint = layer.paint;
    const iconColor = paint?.['icon-color'];
    const textColor = paint?.['text-color'];
    return {
      iconColor: typeof iconColor === 'string' ? iconColor : '',
      textColor: typeof textColor === 'string' ? textColor : '',
    };
  }

  /**
   * Create an SVG symbol from a MapLibre layer specification (from current map style)
   * Uses MapLibre's typed layer specifications directly
   */
  private createSymbolFromMapLibreLayer(layer: LayerSpecification): SVGSVGElement | null {
    if (layer.type === 'fill') {
      return this.createFillSymbol(this.extractFillParams(layer));
    }
    if (layer.type === 'line') {
      return this.createLineSymbol(this.extractLineParams(layer));
    }
    if (layer.type === 'circle') {
      return this.createCircleSymbol(this.extractCircleParams(layer));
    }
    if (layer.type === 'symbol') {
      return this.createSymbolLayerSymbol(this.extractSymbolParams(layer));
    }
    return null;
  }

  /**
   * Create an SVG symbol from a style JSON layer (from fetched external style)
   * Uses our own typed interfaces for external style JSON
   */
  private createSymbolFromStyleJsonLayer(layer: StyleJsonLayer): SVGSVGElement | null {
    if (layer.type === 'fill') {
      const paint = layer.paint;
      return this.createFillSymbol({
        color: paint?.['fill-color'] ?? '#888',
        opacity: paint?.['fill-opacity'] ?? 1,
        outlineColor: paint?.['fill-outline-color'] ?? '',
      });
    }
    if (layer.type === 'line') {
      const paint = layer.paint;
      const layout = layer.layout;
      return this.createLineSymbol({
        color: paint?.['line-color'] ?? '#333',
        width: paint?.['line-width'] ?? 2,
        opacity: paint?.['line-opacity'] ?? 1,
        dasharray: paint?.['line-dasharray'] ?? null,
        cap: layout?.['line-cap'] ?? null,
      });
    }
    if (layer.type === 'circle') {
      const paint = layer.paint;
      return this.createCircleSymbol({
        color: paint?.['circle-color'] ?? '#888',
        radius: paint?.['circle-radius'] ?? 6,
        opacity: paint?.['circle-opacity'] ?? 1,
        strokeColor: paint?.['circle-stroke-color'] ?? '',
        strokeWidth: paint?.['circle-stroke-width'] ?? 1,
      });
    }
    if (layer.type === 'symbol') {
      const paint = layer.paint;
      return this.createSymbolLayerSymbol({
        iconColor: paint?.['icon-color'] ?? '',
        textColor: paint?.['text-color'] ?? '',
      });
    }
    return null;
  }

  /**
   * Create a symbol layer SVG (for icons/markers)
   */
  private createSymbolLayerSymbol(params: SymbolLegendParams): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 32 20");
    svg.style.display = "block";

    // Create a simple marker representation
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "16");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", "6");
    circle.setAttribute("fill", params.iconColor || params.textColor || '#888');
    circle.setAttribute("stroke", "#333");
    circle.setAttribute("stroke-width", "1");

    svg.appendChild(circle);
    return svg;
  }

  /**
   * Create a fill symbol SVG
   */
  private createFillSymbol(params: FillLegendParams): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 32 20");
    svg.style.display = "block";

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "1");
    rect.setAttribute("y", "1");
    rect.setAttribute("width", "30");
    rect.setAttribute("height", "18");
    rect.setAttribute("fill", params.color);
    rect.setAttribute("fill-opacity", String(params.opacity));

    // Add outline if present
    if (params.outlineColor) {
      rect.setAttribute("stroke", params.outlineColor);
      rect.setAttribute("stroke-width", "1");
    }

    svg.appendChild(rect);
    return svg;
  }

  /**
   * Create a line symbol SVG with dash pattern support
   */
  private createLineSymbol(params: LineLegendParams): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 32 20");
    svg.style.display = "block";

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "2");
    line.setAttribute("y1", "10");
    line.setAttribute("x2", "30");
    line.setAttribute("y2", "10");
    line.setAttribute("stroke", params.color);
    line.setAttribute("stroke-width", String(params.width));
    line.setAttribute("stroke-opacity", String(params.opacity));

    // Handle dash patterns
    if (params.dasharray && params.dasharray.length > 0) {
      // Scale dash pattern for legend visibility
      const scaledDash = params.dasharray.map((v) => v * 2).join(' ');
      line.setAttribute("stroke-dasharray", scaledDash);
    }

    // Handle line cap
    if (params.cap) {
      line.setAttribute("stroke-linecap", params.cap);
    }

    svg.appendChild(line);
    return svg;
  }

  /**
   * Create a circle symbol SVG
   */
  private createCircleSymbol(params: CircleLegendParams): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "32");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 32 20");
    svg.style.display = "block";

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "16");
    circle.setAttribute("cy", "10");
    circle.setAttribute("r", String(Math.min(params.radius, 8)));
    circle.setAttribute("fill", params.color);
    circle.setAttribute("fill-opacity", String(params.opacity));

    if (params.strokeColor) {
      circle.setAttribute("stroke", params.strokeColor);
      circle.setAttribute("stroke-width", String(params.strokeWidth));
    }

    svg.appendChild(circle);
    return svg;
  }

  /**
   * Attempt to fetch WMS legend graphic
   * This is for WMS-based sources in MapLibre
   */
  private async getWMSLegend(sourceId: string, source: RasterSourceWithMetadata): Promise<RendererData> {
    try {
      // Get WMS URL and layer name from source metadata
      const wmsUrl = source.metadata?.['wms-url'];
      const layerName = source.metadata?.['wms-layer'];

      if (!wmsUrl || !layerName) {
        console.warn(`Missing WMS metadata for source ${sourceId}, falling back to paint properties`);
        return undefined;
      }

      const legendUrl = `${wmsUrl}?service=WMS&request=GetLegendGraphic&format=application/json&layer=${layerName}&version=1.3.0`;

      const response = await fetch(legendUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch WMS legend: ${response.status}`);
        return undefined;
      }

      // Check if response is actually JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        console.warn(`WMS legend returned non-JSON content: ${contentType}`);
        return undefined;
      }

      const legendData: Legend = await response.json();
      const rules = legendData?.Legend?.[0]?.rules || [];

      if (rules.length === 0) {
        return undefined;
      }

      const isAutoGeneratedDefaultSymbolizer = (rule: LegendRule) => {
        const symbolizer = rule.symbolizers?.[0]?.Point;
        const graphic = symbolizer?.graphics?.[0];
        return rule.symbolizers?.length === 1 &&
          symbolizer &&
          symbolizer.graphics?.length === 1 &&
          graphic?.mark &&
          !graphic.fill &&
          !graphic.stroke;
      };

      const previews: RegularLayerRenderer[] = [];

      for (const rule of rules) {
        const isAutoGeneratedDefault = isAutoGeneratedDefaultSymbolizer(rule);
        const label = rule.title || rule.name;

        if (isAutoGeneratedDefault) {
          const emptySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          emptySvg.setAttribute("width", "32");
          emptySvg.setAttribute("height", "20");
          emptySvg.setAttribute("viewBox", "0 0 32 20");
          emptySvg.style.display = "block";
          emptySvg.style.visibility = "hidden";

          previews.push({
            type: 'regular-layer-renderer' as const,
            label: label,
            renderer: emptySvg,
            id: sourceId,
            url: wmsUrl,
          });
        } else {
          previews.push({
            type: 'regular-layer-renderer' as const,
            label: label,
            renderer: createSVGSymbol(rule.symbolizers) as HTMLElement | SVGSVGElement | CompositeSymbolResult,
            id: sourceId,
            url: wmsUrl,
          });
        }
      }

      return previews;
    } catch (error) {
      console.warn('Error fetching WMS legend:', error);
      return undefined;
    }
  }

  /**
   * Fetch WMS legend graphic for a specific layer (used by WFS layers)
   */
  private async getWMSLegendForLayer(wmsUrl: string, layerName: string): Promise<RendererData> {
    const mockSource: RasterSourceWithMetadata = {
      metadata: {
        'wms-url': wmsUrl,
        'wms-layer': layerName,
      }
    };
    return this.getWMSLegend(layerName, mockSource);
  }

}
