/**
 * Layer type guards, traversal, and URL parsing utilities
 */
import type { LayerProps, WMSLayerProps, WFSLayerProps, PMTilesLayerProps, GroupLayerProps, ArcGISMapServerLayerProps } from '@/lib/types/mapping-types'

// ── Type guards ──────────────────────────────────────────────────────

export const isWMSLayer = (layer: LayerProps): layer is WMSLayerProps =>
  layer.type === 'wms'

export const isWFSLayer = (layer: LayerProps): layer is WFSLayerProps =>
  layer.type === 'wfs'

export const isPMTilesLayer = (layer: LayerProps): layer is PMTilesLayerProps =>
  layer.type === 'pmtiles'

export const isGroupLayer = (layer: LayerProps): layer is GroupLayerProps =>
  layer.type === 'group'

export const isArcGISMapServerLayer = (layer: LayerProps): layer is ArcGISMapServerLayerProps =>
  layer.type === 'map-image'

// ── Generic layer flattening ─────────────────────────────────────────

/**
 * Recursively flatten layer groups into a flat array of visible layers
 * matching the given type guard.
 */
export function flattenVisibleLayers<T extends LayerProps>(
  layers: LayerProps[],
  guard: (layer: LayerProps) => layer is T,
): T[] {
  const result: T[] = []
  for (const layer of layers) {
    if (isGroupLayer(layer) && layer.layers) {
      result.push(...flattenVisibleLayers(layer.layers, guard))
    } else if (guard(layer) && layer.visible === true) {
      result.push(layer)
    }
  }
  return result
}

export const flattenWmsLayers = (layers: LayerProps[]) =>
  flattenVisibleLayers(layers, isWMSLayer)

export const flattenWfsLayers = (layers: LayerProps[]) =>
  flattenVisibleLayers(layers, isWFSLayer)

export const flattenArcGisLayers = (layers: LayerProps[]) =>
  flattenVisibleLayers(layers, isArcGISMapServerLayer)

// ── Layer search ─────────────────────────────────────────────────────

/**
 * Find any layer by title, searching recursively through groups
 */
export function findLayerByTitle(layers: LayerProps[], title: string): LayerProps | null {
  for (const layer of layers) {
    if (isGroupLayer(layer) && layer.layers) {
      const found = findLayerByTitle(layer.layers, title)
      if (found) return found
    } else if (layer.title === title) {
      return layer
    }
  }
  return null
}

// ── URL parsing & building ───────────────────────────────────────────

export interface ParsedWmsUrl {
  baseUrl: string
  workspace: string
  wfsUrl: string
}

/**
 * Parse a WMS URL to extract base URL, workspace, and WFS URL
 * @example parseWmsUrl('https://example.com/geoserver/hazards/wms')
 * // => { baseUrl: 'https://example.com/geoserver/hazards', workspace: 'hazards', wfsUrl: 'https://example.com/geoserver/hazards/wfs' }
 */
export function parseWmsUrl(wmsUrl: string): ParsedWmsUrl | null {
  const urlParts = wmsUrl.split('/')
  const wmsIndex = urlParts.indexOf('wms')
  if (wmsIndex <= 0) return null

  const workspace = urlParts[wmsIndex - 1]
  const baseUrl = urlParts.slice(0, wmsIndex).join('/')
  const wfsUrl = `${baseUrl}/wfs`

  return { baseUrl, workspace, wfsUrl }
}

/**
 * Build a WMS GetMap tile URL for MapLibre
 */
export function buildWmsTileUrl(baseUrl: string, layerName: string, cqlFilter?: string, customLayerParameters?: Record<string, string> | null): string {
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.0',
    request: 'GetMap',
    layers: layerName,
    styles: '',
    srs: 'EPSG:3857',
    width: '512',
    height: '512',
    format: 'image/png',
    transparent: 'true',
  })

  // Merge dynamic UI filter with static customLayerParameters cql_filter
  const staticCql = customLayerParameters?.cql_filter
  const mergedCql = cqlFilter && staticCql
    ? `(${cqlFilter}) AND (${staticCql})`
    : cqlFilter || staticCql
  if (mergedCql) {
    params.set('CQL_FILTER', mergedCql)
  }

  // Add remaining custom parameters (excluding cql_filter already handled above)
  if (customLayerParameters) {
    for (const [key, value] of Object.entries(customLayerParameters)) {
      if (key === 'cql_filter') continue
      params.set(key, value)
    }
  }
  return `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`
}

/**
 * Extract WMS layer name from layer config
 * Sublayer name is already in workspace:layername format
 */
export function getWmsLayerName(layer: WMSLayerProps): string {
  const sublayerName = layer.sublayers?.[0]?.name
  if (sublayerName) {
    return sublayerName
  }
  return layer.title
}

/**
 * Build an ArcGIS MapServer export tile URL for MapLibre
 */
export function buildArcGisExportUrl(baseUrl: string): string {
  return `${baseUrl}/export?bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&f=image&bbox={bbox-epsg-3857}`
}
