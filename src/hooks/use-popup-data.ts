/**
 * Hook to prepare popup data from query results
 *
 * Pure formatter — no fetching. Handles:
 * - Grouping vector features by layer
 * - Merging pre-fetched raster results into popup data
 * - Including raster-only layers (no vector features but has raster data)
 * - Returning unified PopupData ready for display
 */
import { useMemo } from 'react'
import type { FeatureCollection, GeoJsonProperties } from 'geojson'
import type { WfsFeature, RasterQueryResult } from '@/lib/map/wfs-service'
import type { LayerProps, ProcessedRasterSource } from '@/lib/types/mapping-types'
import type { LayerContentProps, ExtendedFeature } from '@/components/maps/popups/types'
import { findLayerByTitle } from '@/lib/map/layer-utils'

interface UsePopupDataOptions {
  /** Vector features from WFS query */
  vectorFeatures: WfsFeature[]
  /** Pre-fetched raster results from unified click mutation */
  rasterResults: Map<string, RasterQueryResult>
  /** Click point (WGS84) — used for display/formatting */
  clickPoint: { lng: number; lat: number } | null
  /** Optional bbox — kept for future use */
  clickBbox?: { sw: [number, number]; ne: [number, number] } | null
  /** Layer configuration to look up popupFields, etc. */
  layersConfig: LayerProps[]
}

/**
 * Hook that prepares popup data from pre-fetched vector and raster results
 */
export function usePopupData({
  vectorFeatures,
  rasterResults,
  layersConfig,
}: UsePopupDataOptions): {
  popupData: LayerContentProps[]
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

  // Build the raster data map from pre-fetched results
  const rasterDataByLayer = useMemo(() => {
    const result = new Map<string, ProcessedRasterSource>()
    for (const [layerTitle, { data, rasterSource }] of rasterResults) {
      if (data) {
        result.set(layerTitle, {
          ...rasterSource,
          data: 'features' in data ? data as FeatureCollection : null,
        })
      }
    }
    return result
  }, [rasterResults])

  // Build unified popup data
  const popupData = useMemo((): LayerContentProps[] => {
    // Start with layers that have vector features
    const layerTitles = new Set(featuresByLayer.keys())

    // Add raster-only layers (have raster data but no vector features)
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

  return { popupData }
}
