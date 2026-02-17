/**
 * Hook to prepare popup data from WFS query results
 *
 * Handles:
 * - Grouping vector features by layer
 * - Fetching raster values for layers with rasterSource config
 * - Including raster-only layers (no vector features but has rasterSource)
 * - Returning unified PopupData ready for display
 */
import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { FeatureCollection, GeoJsonProperties } from 'geojson'
import type { WfsFeature } from '@/lib/map/wfs-service'
import type { LayerProps, RasterSource, ProcessedRasterSource } from '@/lib/types/mapping-types'
import type { LayerContentProps, ExtendedFeature } from '@/components/maps/popups/types'
import type { GeoServerGeoJSON } from '@/lib/types/geoserver-types'
import { convertCoordinate } from '@/lib/map/conversion-utils'
import { createPointBufferBbox } from '@/lib/map/utils'
import { findLayerByTitle, flattenWmsLayers } from '@/lib/map/layer-utils'

interface UsePopupDataOptions {
  /** Vector features from WFS query */
  vectorFeatures: WfsFeature[]
  /** Click point for raster queries (WGS84) */
  clickPoint: { lng: number; lat: number } | null
  /** Optional bbox for raster query accuracy */
  clickBbox?: { sw: [number, number]; ne: [number, number] } | null
  /** Layer configuration to look up popupFields, rasterSource, etc. */
  layersConfig: LayerProps[]
}

interface RasterQueryConfig {
  layerTitle: string
  rasterSource: RasterSource
}

/**
 * Fetch WMS GetFeatureInfo for a raster layer at a point
 */
async function fetchRasterValue(
  rasterSource: RasterSource,
  point: { lng: number; lat: number },
  bbox?: { sw: [number, number]; ne: [number, number] } | null
): Promise<GeoServerGeoJSON | null> {
  // Use provided bbox or create a proper 100m buffer around the point
  let sw: [number, number]
  let ne: [number, number]

  if (bbox) {
    sw = bbox.sw
    ne = bbox.ne
  } else {
    // Create a 100m buffer using shared utility (accurate at any latitude)
    const bufferedBbox = createPointBufferBbox([point.lng, point.lat], 0.1)
    if (bufferedBbox) {
      const [minX, minY, maxX, maxY] = bufferedBbox
      sw = [minX, minY]
      ne = [maxX, maxY]
    } else {
      // Fallback to simple offset if buffer fails
      const fallback = 0.001
      sw = [point.lng - fallback, point.lat - fallback]
      ne = [point.lng + fallback, point.lat + fallback]
    }
  }

  const width = 101
  const height = 101

  // Convert to Web Mercator (EPSG:3857) using proj4
  const [sw3857x, sw3857y] = convertCoordinate(sw, 'EPSG:4326', 'EPSG:3857')
  const [ne3857x, ne3857y] = convertCoordinate(ne, 'EPSG:4326', 'EPSG:3857')
  const [x3857, y3857] = convertCoordinate([point.lng, point.lat], 'EPSG:4326', 'EPSG:3857')

  // Calculate pixel position within the bbox
  const pixelX = Math.round(((x3857 - sw3857x) / (ne3857x - sw3857x)) * width)
  const pixelY = Math.round(((ne3857y - y3857) / (ne3857y - sw3857y)) * height)

  const params = new URLSearchParams()
  params.set('service', 'WMS')
  params.set('version', '1.3.0')
  params.set('request', 'GetFeatureInfo')
  params.set('layers', rasterSource.layerName)
  params.set('query_layers', rasterSource.layerName)
  params.set('info_format', 'application/json')
  params.set('CRS', 'EPSG:3857')
  params.set('bbox', `${sw3857x},${sw3857y},${ne3857x},${ne3857y}`)
  params.set('width', width.toString())
  params.set('height', height.toString())
  params.set('i', pixelX.toString())
  params.set('j', pixelY.toString())
  params.set('feature_count', '1')

  const url = `${rasterSource.url}?${params.toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn('[usePopupData] Raster fetch failed:', response.status)
      return null
    }
    return await response.json()
  } catch (error) {
    console.warn('[usePopupData] Raster fetch error:', error)
    return null
  }
}

/**
 * Get all visible WMS layers with rasterSource config
 * Uses flattenWmsLayers utility for consistent layer traversal
 */
function getLayersWithRasterSource(layers: LayerProps[]): Map<string, RasterSource> {
  const result = new Map<string, RasterSource>()

  for (const wmsLayer of flattenWmsLayers(layers)) {
    const sublayer = wmsLayer.sublayers?.[0]
    if (sublayer?.queryable && sublayer?.rasterSource) {
      result.set(wmsLayer.title, sublayer.rasterSource)
    }
  }

  return result
}

/**
 * Hook that prepares popup data from WFS results and fetches raster values
 */
export function usePopupData({
  vectorFeatures,
  clickPoint,
  clickBbox,
  layersConfig,
}: UsePopupDataOptions): {
  popupData: LayerContentProps[]
  isLoadingRaster: boolean
} {
  // Group vector features by layer title
  const featuresByLayer = useMemo(() => {
    const grouped = new Map<string, WfsFeature[]>()
    for (const feature of vectorFeatures) {
      const title = feature.layerTitle || 'Unknown Layer'
      if (!grouped.has(title)) grouped.set(title, [])
      grouped.get(title)!.push(feature)
    }
    return grouped
  }, [vectorFeatures])

  // Get all layers with rasterSource config
  const layersWithRaster = useMemo(() => getLayersWithRasterSource(layersConfig), [layersConfig])

  // Determine which layers need raster fetching
  // Include layers that have rasterSource, regardless of whether they have vector features
  const rasterQueries = useMemo((): RasterQueryConfig[] => {
    if (!clickPoint) return []

    const queries: RasterQueryConfig[] = []
    for (const [layerTitle, rasterSource] of layersWithRaster) {
      queries.push({ layerTitle, rasterSource })
    }
    return queries
  }, [clickPoint, layersWithRaster])

  // Fetch raster values for all layers in parallel
  const rasterResults = useQueries({
    queries: rasterQueries.map(({ layerTitle, rasterSource }) => ({
      queryKey: ['rasterValue', rasterSource.layerName, clickPoint?.lng, clickPoint?.lat],
      queryFn: async () => {
        if (!clickPoint) return null
        const data = await fetchRasterValue(rasterSource, clickPoint, clickBbox)
        return { layerTitle, rasterSource, data }
      },
      enabled: !!clickPoint,
      staleTime: 5 * 60 * 1000, // 5 minutes
    })),
  })

  const isLoadingRaster = rasterResults.some(r => r.isLoading)

  // Build the raster data map
  const rasterDataByLayer = useMemo(() => {
    const result = new Map<string, ProcessedRasterSource>()
    for (const queryResult of rasterResults) {
      if (queryResult.data?.data && queryResult.data.rasterSource) {
        const { layerTitle, rasterSource, data } = queryResult.data
        result.set(layerTitle, {
          ...rasterSource,
          data: data && 'features' in data ? data as FeatureCollection : null,
        })
      }
    }
    return result
  }, [rasterResults])

  // Build unified popup data
  const popupData = useMemo((): LayerContentProps[] => {
    // Start with layers that have vector features
    const layerTitles = new Set(featuresByLayer.keys())

    // Add raster-only layers (have rasterSource + raster data, but no vector features)
    for (const [layerTitle] of rasterDataByLayer) {
      if (!layerTitles.has(layerTitle)) {
        layerTitles.add(layerTitle)
      }
    }

    // If nothing to show, return empty
    if (layerTitles.size === 0) return []

    const result: LayerContentProps[] = []

    for (const title of layerTitles) {
      const features = featuresByLayer.get(title) || []
      const layer = findLayerByTitle(layersConfig, title)
      // Access sublayers for layer types that have them (WMS, WFS, PMTiles)
      const sublayerConfig = layer && 'sublayers' in layer ? layer.sublayers?.[0] : undefined
      const processedRasterSource = rasterDataByLayer.get(title)

      // Skip if no features AND no raster data
      if (features.length === 0 && !processedRasterSource) continue

      result.push({
        groupLayerTitle: title,
        layerTitle: title,
        sourceCRS: 'EPSG:4326',
        visible: true,
        popupFields: sublayerConfig?.popupFields,
        relatedTables: sublayerConfig?.relatedTables,
        linkFields: sublayerConfig?.linkFields,
        colorCodingMap: sublayerConfig?.colorCodingMap,
        colorCodingMode: sublayerConfig?.colorCodingMode,
        rasterSource: processedRasterSource,
        maxZoomLevel: layer?.maxZoomLevel,
        features: features.map((f): ExtendedFeature => ({
          type: 'Feature',
          id: f.id,
          geometry: f.geometry || { type: 'Point', coordinates: [0, 0] },
          properties: f.properties as GeoJsonProperties,
          namespace: title,
        })),
      })
    }

    return result
  }, [featuresByLayer, rasterDataByLayer, layersConfig])

  return { popupData, isLoadingRaster }
}
