import type { Geometry, Polygon } from 'geojson'
import type { LayerProps } from '@/lib/types/mapping-types'
import type { WfsFeature } from '@/lib/map/wfs-service'

// Re-export for convenience
export type ClickedFeature = WfsFeature

export type DrawMode = 'off' | 'rectangle' | 'polygon'

export type SpatialFilter = {
  type: 'bbox' | 'polygon'
  bbox?: [number, number, number, number]
  polygon?: Polygon
} | null

export interface HighlightFeature {
  id: string | number
  geometry: Geometry
  properties?: Record<string, unknown>
}

export type BoundsBox = {
  sw: [number, number]
  ne: [number, number]
}

export interface DataMapProps {
  wmsUrl: string
  layers: LayerProps[]
  center?: [number, number]
  zoom?: number
  highlightFeatures?: HighlightFeature[]
  onFeatureClick?: (features: ClickedFeature[], options?: { additive?: boolean }) => void
  onMoveEnd?: (lat: number, lng: number, zoom: number) => void
  clickTolerance?: number
  isLoading?: boolean
  children?: React.ReactNode
  /** Controlled shift/additive mode from parent */
  isAdditiveMode?: boolean
  /** Callback to toggle additive mode */
  onAdditiveModeToggle?: () => void
  /** Terra Draw props */
  drawMode?: DrawMode
  onDrawModeChange?: (mode: DrawMode) => void
  spatialFilter?: SpatialFilter
  onSpatialFilterChange?: (filter: SpatialFilter) => void
  /** Box select mode - shows positioning overlay */
  boxSelectMode?: boolean
  onBoxSelectModeChange?: (active: boolean) => void
  /** Frozen box select bounds (geographic coordinates) - rendered as layer */
  boxSelectBounds?: BoundsBox | null
  /** Callback when box select is confirmed - receives frozen geographic bbox */
  onBoxSelectConfirm?: (bounds: BoundsBox) => void
  /** CQL filters for WMS layers, keyed by layer title */
  layerFilters?: Record<string, string>
  /** Callback when map is ready - exposes raw MapLibre map instance */
  onMapReady?: (map: maplibregl.Map) => void
  /** Basemap ID from URL */
  basemapId?: string
  /** Click buffer bounds for visualization (controlled by parent) */
  clickBufferBounds?: BoundsBox | null
  /** Callback when click buffer should update */
  onClickBufferChange?: (bounds: BoundsBox | null) => void
  /** Feature geometry bounds for zoom extent (controlled by parent) */
  featureBbox?: BoundsBox | null
  /** Callback when feature bbox should update */
  onFeatureBboxChange?: (bbox: BoundsBox | null) => void
  /** Callback when selection should be cleared (from context menu) */
  onClearSelection?: () => void
}
