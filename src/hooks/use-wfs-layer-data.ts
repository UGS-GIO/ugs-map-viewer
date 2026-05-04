import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { FeatureCollection, Geometry } from 'geojson'
import type { WFSLayerProps } from '@/lib/types/mapping-types'
import { queryKeys } from '@/lib/query-keys'
import type maplibregl from 'maplibre-gl'

/** Feature returned from client-side WFS layer queries */
export interface WfsLayerFeature {
  id: string | number
  properties: Record<string, unknown>
  geometry?: Geometry
  layerTitle: string
}

/**
 * Fetch GeoJSON data from a WFS GetFeature request
 */
async function fetchWfsGeoJson(layer: WFSLayerProps): Promise<FeatureCollection<Geometry>> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layer.typeName,
    outputFormat: 'application/json',
    srsName: layer.crs || 'EPSG:4326',
  })
  const url = `${layer.wfsUrl}?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`WFS request failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Generate a source ID for a WFS layer (used as MapLibre source/layer ID)
 */
export function getWfsSourceId(layer: WFSLayerProps): string {
  return `wfs-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase()
}

/**
 * Query WFS layer features within a screen bbox using MapLibre's queryRenderedFeatures
 */
export function queryWfsLayersInScreenBbox(
  map: maplibregl.Map,
  bbox: [maplibregl.PointLike, maplibregl.PointLike],
  wfsLayers: WFSLayerProps[]
): WfsLayerFeature[] {
  if (wfsLayers.length === 0) return []

  // Query point (-circle), symbol (-symbol), and polygon (-fill) layer IDs, filtering to those that exist
  const wfsLayerIds = wfsLayers.flatMap(layer => {
    const sourceId = getWfsSourceId(layer)
    return [`${sourceId}-circle`, `${sourceId}-symbol`, `${sourceId}-fill`].filter(id => map.getLayer(id))
  })
  if (wfsLayerIds.length === 0) return []
  const features = map.queryRenderedFeatures(bbox, { layers: wfsLayerIds })

  return features.map(f => {
    const mapLayer = map.getLayer(f.layer.id)
    const metadata = mapLayer?.metadata as { title?: string } | undefined
    return {
      id: f.id ?? f.properties?.ogc_fid ?? 0,
      properties: f.properties as Record<string, unknown>,
      geometry: f.geometry,
      layerTitle: metadata?.title || 'Unknown Layer',
    }
  })
}

/** Query WFS layers at a point with tolerance */
export function queryWfsLayersAtPoint(
  map: maplibregl.Map,
  point: { x: number; y: number },
  tolerance: number,
  wfsLayers: WFSLayerProps[]
): WfsLayerFeature[] {
  return queryWfsLayersInScreenBbox(
    map,
    [[point.x - tolerance, point.y - tolerance], [point.x + tolerance, point.y + tolerance]],
    wfsLayers
  )
}

/**
 * Hook to fetch WFS layer data using TanStack Query
 * Uses useQueries for parallel fetching with per-layer caching
 */
export function useWfsLayerData(layers: WFSLayerProps[]) {
  const queries = useQueries({
    queries: layers.map(layer => ({
      queryKey: queryKeys.layers.wfsData(layer.wfsUrl, layer.typeName),
      queryFn: () => fetchWfsGeoJson(layer),
      staleTime: Infinity, // WFS data rarely changes within a session
      gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    })),
  })

  // Aggregate query results into a Map keyed by source ID
  const data = useMemo(() => {
    const result = new Map<string, FeatureCollection<Geometry>>()
    layers.forEach((layer, index) => {
      const query = queries[index]
      if (query.data) {
        const sourceId = getWfsSourceId(layer)
        result.set(sourceId, query.data)
      }
    })
    return result
  }, [layers, queries])

  const isLoading = queries.some(q => q.isLoading)
  const isError = queries.some(q => q.isError)

  return { data, isLoading, isError }
}
