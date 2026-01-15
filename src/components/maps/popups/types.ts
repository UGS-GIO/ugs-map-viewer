/**
 * Popup-related types and utilities
 */
import type { Feature, Geometry, GeoJsonProperties } from 'geojson'
import type {
    FieldConfig,
    ProcessedRasterSource,
    RelatedTable,
    LinkFields,
    ColorCodingRecordFunction,
    ColorCodingMode,
} from '@/lib/types/mapping-types'

/**
 * Extended GeoJSON Feature with namespace for layer identification
 */
export interface ExtendedFeature extends Feature<Geometry, GeoJsonProperties> {
    namespace: string
}

/**
 * Props for a layer's popup content
 */
export interface LayerContentProps {
    groupLayerTitle: string
    layerTitle: string
    features: ExtendedFeature[]
    sourceCRS: string
    popupFields?: Record<string, FieldConfig>
    relatedTables?: RelatedTable[]
    linkFields?: LinkFields
    colorCodingMap?: ColorCodingRecordFunction
    colorCodingMode?: ColorCodingMode
    customLayerParameters?: { cql_filter?: string; [key: string]: unknown }
    rasterSource?: ProcessedRasterSource
    visible: boolean
    queryable?: boolean
    schema?: string
    layerCrs?: string
    wfsUrl?: string
    typeName?: string
}

/**
 * Check if a layer has raster data to display
 */
export function hasRasterData(layer: LayerContentProps): boolean {
    return !!layer.rasterSource?.data?.features?.length
}

/**
 * Get display count text for a layer (accounts for raster-only layers)
 */
export function getLayerCountText(layer: LayerContentProps): string {
    const featureCount = layer.features?.length || 0
    if (featureCount > 0) {
        return `${featureCount} feature${featureCount !== 1 ? 's' : ''}`
    }
    if (hasRasterData(layer)) {
        return 'raster data'
    }
    return '0 features'
}
