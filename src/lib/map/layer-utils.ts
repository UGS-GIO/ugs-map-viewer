/**
 * Layer traversal and URL parsing utilities
 */
import type { LayerProps, WMSLayerProps } from '@/lib/types/mapping-types'

/**
 * Recursively flatten layer groups into a flat array of visible WMS layers
 */
export function flattenWmsLayers(layers: LayerProps[]): WMSLayerProps[] {
  const result: WMSLayerProps[] = []
  for (const layer of layers) {
    if (layer.type === 'group' && 'layers' in layer && layer.layers) {
      result.push(...flattenWmsLayers(layer.layers))
    } else if (layer.type === 'wms' && layer.visible === true) {
      result.push(layer as WMSLayerProps)
    }
  }
  return result
}

/**
 * Find a WMS layer by title, searching recursively through groups
 */
export function findWmsLayerByTitle(layers: LayerProps[], title: string): WMSLayerProps | null {
  for (const layer of layers) {
    if (layer.type === 'group' && 'layers' in layer && layer.layers) {
      const found = findWmsLayerByTitle(layer.layers, title)
      if (found) return found
    } else if (layer.type === 'wms') {
      const wmsLayer = layer as WMSLayerProps
      if (wmsLayer.title === title) {
        return wmsLayer
      }
    }
  }
  return null
}

/**
 * Parsed WMS URL components
 */
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
export function buildWmsTileUrl(baseUrl: string, layerName: string, cqlFilter?: string): string {
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
  if (cqlFilter) {
    params.set('CQL_FILTER', cqlFilter)
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
