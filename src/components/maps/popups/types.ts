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
    PopupFieldsTableConfig,
    PMTilesRender,
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
    popupFieldsTable?: PopupFieldsTableConfig[]
    relatedTables?: RelatedTable[]
    relatedTablesPosition?: 'above' | 'below'
    /** STAC by-* render legends (symbology) off the owning layer, when it's STAC-backed pmtiles. */
    renders?: PMTilesRender[]
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
