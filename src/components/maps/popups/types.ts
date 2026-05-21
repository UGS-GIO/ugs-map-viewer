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
    ImageFieldConfig,
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
    imageFields?: ImageFieldConfig[]
    colorCodingMap?: ColorCodingRecordFunction
    colorCodingMode?: ColorCodingMode
    customLayerParameters?: Record<string, string> | null
    rasterSource?: ProcessedRasterSource
    /** 'cog' = client-side pixel sample (yellow); 'wms-raster' or 'vector' use the buffer (green). */
    sourceKind?: 'cog' | 'wms-raster' | 'vector'
    visible: boolean
    queryable?: boolean
    schema?: string
    layerCrs?: string
    wfsUrl?: string
    typeName?: string
    maxZoomLevel?: number
}

/**
 * Check if a layer has raster data to display
 */
export function hasRasterData(layer: LayerContentProps): boolean {
    return !!layer.rasterSource?.data?.features?.length
}

/**
 * Single predicate for "is this layer card worth rendering?" — true when the
 * layer carries at least one vector feature OR a non-empty raster payload.
 * Used as the gate everywhere: the popup model prunes anything that doesn't
 * pass, sheet open/close logic derives from the resulting card count, and the
 * pagination view defends against any leftover empties.
 */
export function hasRenderableContent(layer: LayerContentProps): boolean {
    return layer.features.length > 0 || hasRasterData(layer)
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
