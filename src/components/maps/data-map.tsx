import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useWfsLayerData, getWfsSourceId, queryWfsLayersInScreenBbox, queryWfsLayersAtPoint, type WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import Map, { NavigationControl, Source, Layer, Marker, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  DEFAULT_CLICK_TOLERANCE,
  BOX_SELECT_SIZE,
  BOX_SELECT_PAGE_SIZE,
  BOX_SELECT_MIN_ZOOM,
} from './constants'
import { BASEMAP_STYLES, DEFAULT_BASEMAP } from '@/lib/basemaps'
import { BoxSelectOverlay, ViewModeControl, MapToolsControl } from './controls'
import { HighlightLayers, SpatialFilterLayer, ClickBufferLayer } from './layers'
import { flattenDataLayersWithAncestors, resolveLeafVisibility, isWMSLayer, isWFSLayer, isArcGISMapServerLayer, isCOGLayer, isPMTilesLayer, buildWmsTileUrl, buildArcGisExportUrl, getWmsLayerName } from '@/lib/map/layer-utils'
import { useLayerUrl } from '@/context/layer-url-provider'
import { PMTilesLayerSource, usePMTilesStyleFragments, getPmtilesLayerId, queryPmtilesLayersAtPoint } from '@/components/maps/pmtiles-layer-source'
import type { WMSLayerProps, WFSLayerProps, ArcGISMapServerLayerProps, COGLayerProps, PMTilesLayerProps } from '@/lib/types/mapping-types'
import type maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

import { useCogRange } from '@/hooks/use-cog-metadata'
import { CogPixelHighlight } from '@/components/maps/cog-pixel-highlight'
import { buildCogProtocolUrl } from '@/lib/map/cog/setup'
import { calculateBboxFromGeometry } from '@/lib/map/geometry-utils'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import { useTerraDraw } from '@/hooks/use-terra-draw'
import type { Polygon } from 'geojson'
import { bbox as turfBbox } from '@turf/bbox'
import { useFeatureQuery } from '@/hooks/use-feature-query'
import type { ClickedFeature, DataMapProps } from './types'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { MapContextMenu, type ContextMenuCoords } from './map-context-menu'
import { toast } from 'sonner'

// Re-export types for consumers
export type { DrawMode, SpatialFilter, HighlightFeature, ClickedFeature, DataMapProps } from './types'

type DataLayer = WMSLayerProps | WFSLayerProps | ArcGISMapServerLayerProps | COGLayerProps | PMTilesLayerProps

// MapLibre layer id used for z-order lookups. Keep prefixes stable — popup/query code greps for them.
function getLayerId(layer: DataLayer): string {
  if (isWMSLayer(layer)) return `wms-layer-${layer.title}`
  if (isWFSLayer(layer)) return `${getWfsSourceId(layer)}-circle`
  if (isCOGLayer(layer)) return `cog-layer-${layer.title}`
  if (isPMTilesLayer(layer)) return getPmtilesLayerId(layer)
  return `arcgis-layer-${layer.title}`
}

function CogLayerSource({ layer, beforeId, hidden, opacity }: { layer: COGLayerProps; beforeId: string | undefined; hidden?: boolean; opacity?: number }) {
  // Dynamic stretch from COG-embedded stats (gdal_edit -stats); STAC URL is fallback.
  const range = useCogRange(layer)
  if (!range) return null
  const tileUrl = buildCogProtocolUrl(layer, range)
  return (
    <Source id={`cog-${layer.title}`} type="raster" url={tileUrl} tileSize={256}>
      <Layer
        id={`cog-layer-${layer.title}`}
        beforeId={beforeId}
        type="raster"
        layout={{ visibility: hidden ? 'none' : 'visible' }}
        paint={{ 'raster-opacity': opacity ?? layer.opacity ?? 0.9 }}
        metadata={{ title: layer.title, cogUrl: layer.cogUrl }}
      />
    </Source>
  )
}

function WmsLayerSource({
  layer, wmsUrl, cqlFilter, styleName, beforeId, hidden, opacity,
}: {
  layer: WMSLayerProps
  wmsUrl: string
  cqlFilter: string | undefined
  styleName: string | undefined
  beforeId: string | undefined
  hidden?: boolean
  opacity?: number
}) {
  const layerName = getWmsLayerName(layer)
  const layerWmsUrl = layer.url || wmsUrl
  const tileUrl = buildWmsTileUrl(layerWmsUrl, layerName, cqlFilter, layer.customLayerParameters, styleName)
  return (
    <Source id={`wms-${layer.title}`} type="raster" tiles={[tileUrl]} tileSize={512}>
      <Layer
        id={`wms-layer-${layer.title}`}
        beforeId={beforeId}
        type="raster"
        layout={{ visibility: hidden ? 'none' : 'visible' }}
        paint={{ 'raster-opacity': opacity ?? layer.opacity ?? 0.8 }}
        metadata={{ title: layer.title, 'wms-url': layerWmsUrl, 'wms-layer': layerName }}
      />
    </Source>
  )
}

function ArcGisLayerSource({ layer, beforeId, hidden, opacity }: { layer: ArcGISMapServerLayerProps; beforeId: string | undefined; hidden?: boolean; opacity?: number }) {
  return (
    <Source id={`arcgis-${layer.title}`} type="raster" tiles={[buildArcGisExportUrl(layer.url)]} tileSize={512}>
      <Layer
        id={`arcgis-layer-${layer.title}`}
        beforeId={beforeId}
        type="raster"
        layout={{ visibility: hidden ? 'none' : 'visible' }}
        paint={{ 'raster-opacity': opacity ?? layer.opacity ?? 0.8 }}
        metadata={{ title: layer.title, 'arcgis-url': layer.url }}
      />
    </Source>
  )
}

function WfsLayerSource({
  layer, geojson, beforeId, layerFilter, activeSymbology, hidden, opacity,
}: {
  layer: WFSLayerProps
  geojson: FeatureCollection
  beforeId: string | undefined
  layerFilter?: maplibregl.FilterSpecification
  activeSymbology?: string
  hidden?: boolean
  opacity?: number
}) {
  const sourceId = getWfsSourceId(layer)
  const styleConfig = layer.style || {}

  let circleRadius: number | maplibregl.ExpressionSpecification = styleConfig.circleRadius || 6
  if (styleConfig.circleRadiusByZoom && styleConfig.circleRadiusByZoom.length >= 2) {
    const stops = styleConfig.circleRadiusByZoom
    const expr: unknown[] = ['interpolate', ['linear'], ['zoom'], ...stops.flat()]
    circleRadius = expr as maplibregl.ExpressionSpecification
  }
  if (styleConfig.circleRadiusProperty) {
    const { field, stops } = styleConfig.circleRadiusProperty
    const [minVal, minRadius, maxVal, maxRadius] = stops
    const maxCap = styleConfig.maxCircleRadius ?? 35
    const cappedMax = Math.min(maxRadius, maxCap)
    circleRadius = [
      'min', cappedMax,
      ['max', minRadius,
        ['interpolate', ['linear'],
          ['coalesce', ['get', field], minVal],
          minVal, minRadius,
          maxVal, cappedMax,
        ],
      ],
    ]
  }

  let circleColor: string | maplibregl.ExpressionSpecification = styleConfig.circleColor || '#088'
  if (styleConfig.circleColorProperty) {
    const { field, stops, defaultColor } = styleConfig.circleColorProperty
    circleColor = ['step', ['coalesce', ['get', field], -Infinity], defaultColor, ...stops.flat()]
  } else if (styleConfig.circleColorMatch) {
    const { field, matches, defaultColor } = styleConfig.circleColorMatch
    const expr: unknown[] = ['match', ['coalesce', ['get', field], ''], ...Object.entries(matches).flat(), defaultColor]
    circleColor = expr as maplibregl.ExpressionSpecification
  }

  let circleStrokeColor: string | maplibregl.ExpressionSpecification = styleConfig.circleStrokeColor || '#fff'
  if (styleConfig.circleStrokeColorMatch) {
    const { field, matches, defaultColor } = styleConfig.circleStrokeColorMatch
    const expr: unknown[] = ['match', ['coalesce', ['get', field], ''], ...Object.entries(matches).flat(), defaultColor]
    circleStrokeColor = expr as maplibregl.ExpressionSpecification
  }

  const symbolKey = styleConfig.iconSymbologyKey || ''
  const symbolActive = !!symbolKey && activeSymbology === symbolKey
  // `hidden` (group toggle off) wins — both circle + symbol go invisible.
  const circleVisibility = hidden ? 'none' : (symbolActive ? 'none' : 'visible')
  const symbolVisibility = hidden ? 'none' : (symbolActive ? 'visible' : 'none')

  let iconSize: number | maplibregl.ExpressionSpecification = styleConfig.iconSize ?? 1
  if (styleConfig.iconSizeByZoom && styleConfig.iconSizeByZoom.length >= 2) {
    const stops = styleConfig.iconSizeByZoom
    const expr: unknown[] = ['interpolate', ['linear'], ['zoom'], ...stops.flat()]
    iconSize = expr as maplibregl.ExpressionSpecification
  }

  return (
    <Source id={sourceId} type="geojson" data={geojson}>
      <Layer
        id={`${sourceId}-circle`}
        beforeId={beforeId}
        type="circle"
        {...(layerFilter ? { filter: layerFilter } : {})}
        layout={{ visibility: circleVisibility }}
        paint={{
          'circle-radius': circleRadius,
          'circle-color': circleColor,
          'circle-stroke-color': circleStrokeColor,
          'circle-stroke-width': styleConfig.circleStrokeWidth || 1,
          'circle-opacity': opacity ?? layer.opacity ?? 1,
          'circle-stroke-opacity': opacity ?? layer.opacity ?? 1,
        }}
        metadata={{
          title: layer.title,
          wfsLayer: true,
          wfsTypeName: layer.typeName,
          wfsSourceId: sourceId,
        }}
      />
      {styleConfig.iconImageExpression && (
        <Layer
          id={`${sourceId}-symbol`}
          beforeId={beforeId}
          type="symbol"
          {...(layerFilter ? { filter: layerFilter } : {})}
          layout={{
            visibility: symbolVisibility,
            'icon-image': styleConfig.iconImageExpression as maplibregl.ExpressionSpecification,
            'icon-size': iconSize,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
          paint={{
            'icon-opacity': opacity ?? layer.opacity ?? 1,
          }}
          metadata={{
            title: layer.title,
            wfsLayer: true,
            wfsTypeName: layer.typeName,
            wfsSourceId: sourceId,
          }}
        />
      )}
    </Source>
  )
}

/**
 * DataMap - Main map component using react-map-gl
 * Uses TanStack mutation for WFS queries instead of useEffect
 */
export default function DataMap({
  wmsUrl,
  layers = [],
  center = [-111.5, 39.3],
  zoom = 7,
  highlightFeatures = [],
  onFeatureClick,
  onMoveEnd,
  clickTolerance = DEFAULT_CLICK_TOLERANCE,
  isLoading = false,
  isAdditiveMode = false,
  onAdditiveModeToggle,
  children,
  activeDrawShape = 'off',
  onDrawReset,
  onDrawComplete,
  toolbarDrawShape = 'off',
  onToolbarDrawToggle,
  onCancelMode,
  spatialFilter,
  onSpatialFilterChange,
  boxSelectMode = false,
  onBoxSelectModeChange,
  boxSelectBounds,
  onBoxSelectConfirm,
  layerFilters = {},
  layerStyles = {},
  vectorLayerFilters = {},
  vectorLayerSymbology = {},
  onMapReady,
  basemapId,
  clickBufferBounds,
  onClickBufferChange,
  featureBbox,
  onFeatureBboxChange,
  onClearSelection,
  pinCoords,
  onPinChange,
  viewMode,
  onViewModeChange,
  hasResults = false,
}: DataMapProps) {
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track current zoom via ref (avoids full DataMap re-render on every moveend)
  const currentZoomRef = useRef(zoom)
  const [isBoxSelectZoomValid, setIsBoxSelectZoomValid] = useState(zoom >= BOX_SELECT_MIN_ZOOM)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const hasRestoredRef = useRef(false)

  // Context menu state
  const [contextMenuCoords, setContextMenuCoords] = useState<ContextMenuCoords | null>(null)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)

  // isBoxSelectZoomValid is tracked as state above (only re-renders when threshold is crossed)

  // Get the raw map instance (memoized to avoid recreating on every render)
  const mapInstance = mapRef.current?.getMap() ?? null

  // URL state is the source of truth for runtime visibility and opacity overrides.
  // The config tree is never mutated — we compute mount/display per leaf at render time.
  const { selectedLayerTitles, groupVisibility, layerOpacity } = useLayerUrl()

  // Flat list of data leaves in config order (top of sidebar = first), tagged with enclosing groups.
  const dataLeaves = useMemo(() => flattenDataLayersWithAncestors(layers), [layers])

  // `mounted` = checkbox state → drives `<Source>` presence.
  // `displayed` = mounted && every enclosing group toggle on → drives `<Layer layout.visibility>` and queryability.
  const renderEntries = useMemo(() => {
    return dataLeaves.map(({ layer, ancestorGroupTitles }) => {
      const { mounted, displayed } = resolveLeafVisibility(
        layer.title, ancestorGroupTitles, selectedLayerTitles, groupVisibility,
      )
      return { layer, mounted, displayed }
    })
  }, [dataLeaves, selectedLayerTitles, groupVisibility])

  // Mounted-only subset (Sources present). WFS layers also need their geojson before they can
  // be rendered (handled below). Drives rendering and click-query layer lists.
  const mountedLayers = useMemo(() => renderEntries.filter(e => e.mounted), [renderEntries])
  const displayedTitles = useMemo(() => {
    const s = new Set<string>()
    for (const e of renderEntries) if (e.displayed && e.layer.title) s.add(e.layer.title)
    return s
  }, [renderEntries])

  const mountedLayerList = useMemo(() => mountedLayers.map(e => e.layer), [mountedLayers])
  const mountedWfsLayers = useMemo(() => mountedLayerList.filter(isWFSLayer), [mountedLayerList])
  const mountedPmtilesLayers = useMemo(() => mountedLayerList.filter(isPMTilesLayer), [mountedLayerList])

  // Fetch the active render's style fragment for each mounted PMTiles layer.
  const pmtilesFragments = usePMTilesStyleFragments(mountedPmtilesLayers, vectorLayerSymbology)

  // Click queries skip hidden layers — user can't click what they can't see.
  const visibleWmsLayers = useMemo(
    () => mountedLayerList.filter(isWMSLayer).filter(l => displayedTitles.has(l.title)),
    [mountedLayerList, displayedTitles],
  )
  const visibleWfsLayers = useMemo(
    () => mountedWfsLayers.filter(l => displayedTitles.has(l.title)),
    [mountedWfsLayers, displayedTitles],
  )
  const visibleCogLayers = useMemo(
    () => mountedLayerList.filter(isCOGLayer).filter(l => displayedTitles.has(l.title)),
    [mountedLayerList, displayedTitles],
  )
  const visiblePmtilesLayers = useMemo(
    () => mountedPmtilesLayers.filter(l => displayedTitles.has(l.title || '')),
    [mountedPmtilesLayers, displayedTitles],
  )
  // Vector buffer box is meaningful only when a vector layer is the click target; raster sampling alone uses the pixel highlight.
  const hasVectorClickTarget = useMemo(() => visibleWmsLayers.length > 0 || visibleWfsLayers.length > 0 || visiblePmtilesLayers.length > 0, [visibleWmsLayers, visibleWfsLayers, visiblePmtilesLayers])
  // Any clickable layer (WMS / WFS / COG / PMTiles) gates the click handler + URL-state restore.
  const hasClickableLayers = useMemo(
    () => visibleWmsLayers.length > 0 || visibleWfsLayers.length > 0 || visibleCogLayers.length > 0 || visiblePmtilesLayers.length > 0,
    [visibleWmsLayers, visibleWfsLayers, visibleCogLayers, visiblePmtilesLayers],
  )
  const cogClickPoint = useMemo(
    () => clickBufferBounds ? getBboxCenter(clickBufferBounds) : null,
    [clickBufferBounds],
  )

  // Fetch WFS data for any mounted WFS layer (group toggle off shouldn't drop tiles).
  const { data: wfsLayerData } = useWfsLayerData(mountedWfsLayers)

  // Renderable entries: WFS layers wait for geojson, PMTiles for their style
  // fragment, before mounting `<Source>` (keeps `beforeId` z-order valid).
  const renderableEntries = useMemo(() => {
    return mountedLayers.filter(e =>
      (!isWFSLayer(e.layer) || wfsLayerData.get(getWfsSourceId(e.layer)) !== undefined) &&
      (!isPMTilesLayer(e.layer) || pmtilesFragments.get(e.layer.title || '') !== undefined)
    )
  }, [mountedLayers, wfsLayerData, pmtilesFragments])

  // After data lands and the map style is loaded, run any per-layer sprite registration hooks.
  // Idempotent: each hook checks map.hasImage before adding.
  useEffect(() => {
    if (!styleLoaded) return
    const map = mapRef.current?.getMap()
    if (!map) return
    for (const layer of mountedWfsLayers) {
      const register = layer.style?.registerSprites
      if (!register) continue
      const sourceId = getWfsSourceId(layer)
      const data = wfsLayerData.get(sourceId)
      if (data) register(map, data.features)
    }
  }, [styleLoaded, wfsLayerData, mountedWfsLayers])

  // Refs for stable access to layers in callbacks (prevents TerraDraw reinit)
  const visibleWmsLayersRef = useRef(visibleWmsLayers)
  visibleWmsLayersRef.current = visibleWmsLayers
  const visibleWfsLayersRef = useRef(visibleWfsLayers)
  visibleWfsLayersRef.current = visibleWfsLayers
  const visiblePmtilesLayersRef = useRef(visiblePmtilesLayers)
  visiblePmtilesLayersRef.current = visiblePmtilesLayers

  // Ref to store WFS features from polygon query (populated before WMS query completes)
  const polygonWfsLayerFeaturesRef = useRef<WfsLayerFeature[]>([])

  const notifyTruncated = useCallback(() => {
    toast.warning('Result limit reached', {
      description: 'Showing first 10,000 features. Narrow your selection for the rest.',
      duration: 8000,
    })
  }, [])

  const { clickQuery, boxSelectQuery, polygonQuery, isLoading: queryLoading } = useFeatureQuery({
    onPolygonQuerySuccess: ({ features: wmsFeatures, truncated }) => {
      const allFeatures = [...wmsFeatures, ...polygonWfsLayerFeaturesRef.current]
      polygonWfsLayerFeaturesRef.current = []
      if (onFeatureClick && allFeatures.length > 0) {
        onFeatureClick(allFeatures, { additive: false })
      }
      if (truncated) notifyTruncated()
    },
  })

  // Ref for stable access to polygonQuery mutation (prevents callback reference changes)
  const polygonQueryRef = useRef(polygonQuery)
  polygonQueryRef.current = polygonQuery

  // Helper: dispatch features to parent with optional bbox extraction
  function dispatchFeatures(
    features: ClickedFeature[],
    additive: boolean,
    options: { extractBbox?: boolean; clearOnEmpty?: boolean } = {}
  ) {
    if (features.length > 0) {
      onFeatureClick?.(features, { additive })
      if (options.extractBbox) {
        const first = features.find(f => f.geometry)
        if (first?.geometry && onFeatureBboxChange) {
          const bbox = calculateBboxFromGeometry(first.geometry)
          if (bbox) onFeatureBboxChange({ sw: [bbox[0], bbox[1]], ne: [bbox[2], bbox[3]] })
        }
      }
    } else if (options.clearOnEmpty && !additive) {
      onFeatureClick?.([], { additive: false })
      if (options.extractBbox) onFeatureBboxChange?.(null)
    }
  }

  // Helper: query WFS+WMS at a point, merge results, and dispatch
  function queryAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    additive: boolean,
    options: { extractBbox?: boolean; clearOnEmpty?: boolean } = {}
  ) {
    const wfsFeatures = queryWfsLayersAtPoint(map, point, tolerance, visibleWfsLayersRef.current)
    const pmtilesFeatures = queryPmtilesLayersAtPoint(map, point, tolerance, visiblePmtilesLayersRef.current)
    const vectorFeatures = [...pmtilesFeatures, ...wfsFeatures]

    if (visibleWmsLayersRef.current.length === 0) {
      dispatchFeatures(vectorFeatures, additive, options)
      return
    }

    clickQuery.mutate(
      {
        point,
        visibleLayers: visibleWmsLayersRef.current,
        tolerance,
        mapInstance: map,
        wmsUrl,
        layerFilters,
      },
      {
        onSuccess: (wmsFeatures) => {
          dispatchFeatures([...wmsFeatures, ...vectorFeatures], additive, options)
        },
      }
    )
  }

  // Wrap onSpatialFilterChange to also trigger polygon query
  // Uses refs for visibleWmsLayers/visibleWfsLayers and polygonQuery to keep callback stable (prevents TerraDraw reinit)
  const handleSpatialFilterChange = useCallback((filter: NonNullable<typeof spatialFilter> | null) => {
    onSpatialFilterChange?.(filter)

    if (!filter?.polygon) return

    const map = mapRef.current?.getMap()
    const wmsLayers = visibleWmsLayersRef.current
    const wfsLayers = visibleWfsLayersRef.current

    // Query WFS layers client-side within polygon bbox
    let wfsFeatures: WfsLayerFeature[] = []
    if (map && wfsLayers.length > 0) {
      const [minX, minY, maxX, maxY] = turfBbox(filter.polygon)
      const sw = map.project([minX, minY])
      const ne = map.project([maxX, maxY])
      const screenBbox: [maplibregl.PointLike, maplibregl.PointLike] = [[sw.x, ne.y], [ne.x, sw.y]]
      wfsFeatures = queryWfsLayersInScreenBbox(map, screenBbox, wfsLayers)
    }

    // If no WMS layers, just use WFS results directly
    if (wmsLayers.length === 0) {
      if (wfsFeatures.length > 0 && onFeatureClick) {
        onFeatureClick(wfsFeatures, { additive: false })
      }
      return
    }

    // Store WFS features for merging when WMS query completes
    polygonWfsLayerFeaturesRef.current = wfsFeatures

    // Trigger WMS polygon query
    polygonQueryRef.current.mutate({
      polygon: filter.polygon,
      visibleLayers: wmsLayers,
      wmsUrl,
      layerFilters,
    })
  }, [onSpatialFilterChange, wmsUrl, onFeatureClick, layerFilters])

  // Route drawn polygons: external caller consumes (returns true), otherwise spatial filter
  const handleDrawFinished = useCallback((polygon: Polygon, mode: 'rectangle' | 'polygon') => {
    if (onDrawComplete && onDrawComplete(polygon)) return
    const [w, s, e, n] = turfBbox(polygon)
    handleSpatialFilterChange({ type: mode === 'rectangle' ? 'bbox' : 'polygon', bbox: [w, s, e, n], polygon })
  }, [onDrawComplete, handleSpatialFilterChange])

  const { justFinishedDrawingRef } = useTerraDraw({
    map: mapInstance,
    styleLoaded,
    activeDrawShape,
    onDrawReset,
    onDrawFinished: handleDrawFinished,
  })

  // Calculate initial view - use feature_bbox if restoring, otherwise use props
  const initialViewRef = useRef<{
    longitude?: number
    latitude?: number
    zoom?: number
    bounds?: [[number, number], [number, number]]
    fitBoundsOptions?: { padding: number; maxZoom?: number }
  } | null>(null)
  if (!initialViewRef.current) {
    const bbox = featureBbox || clickBufferBounds
    if (bbox) {
      initialViewRef.current = {
        bounds: [bbox.sw, bbox.ne],
        fitBoundsOptions: { padding: 50, maxZoom: 14 }
      }
    } else {
      initialViewRef.current = { longitude: center[0], latitude: center[1], zoom }
    }
  }
  const initialView = initialViewRef.current

  // Build basemap style from URL param or default
  const currentBasemap = useMemo(
    () => BASEMAP_STYLES.find((b) => b.id === (basemapId ?? DEFAULT_BASEMAP.id)) || DEFAULT_BASEMAP,
    [basemapId]
  )

  // Build map style - handle raster tiles vs vector style URLs
  const mapStyle = useMemo((): string | maplibregl.StyleSpecification => {
    if (!currentBasemap.url) {
      return {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f0f0f0' } }],
      } as maplibregl.StyleSpecification
    }

    if (currentBasemap.url.includes('{z}') && currentBasemap.url.includes('{x}') && currentBasemap.url.includes('{y}')) {
      const isUGRC = currentBasemap.url.includes('discover.agrc.utah.gov')
      return {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [currentBasemap.url],
            tileSize: 256,
            attribution: isUGRC ? '© <a href="https://gis.utah.gov">UGRC</a>' : '© Sentinel-2 by EOX',
          },
        },
        layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }],
      } as maplibregl.StyleSpecification
    }

    return currentBasemap.url
  }, [currentBasemap])

  // Handle map click - triggers mutation instead of direct fetch
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (boxSelectMode || activeDrawShape !== 'off') return
    if (justFinishedDrawingRef.current) {
      justFinishedDrawingRef.current = false
      return
    }
    if (!onFeatureClick || !hasClickableLayers) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Clear any existing spatial filter when doing a regular click
    if (spatialFilter) onSpatialFilterChange?.(null)

    // Calculate click buffer bbox for visualization
    const sw = map.unproject([e.point.x - clickTolerance, e.point.y + clickTolerance])
    const ne = map.unproject([e.point.x + clickTolerance, e.point.y - clickTolerance])
    onClickBufferChange?.({ sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat] })

    const isAdditive = isAdditiveMode || (e.originalEvent?.shiftKey ?? false)
    queryAtPoint(map, e.point, clickTolerance, isAdditive, { extractBbox: true, clearOnEmpty: true })
  }, [onFeatureClick, hasClickableLayers, clickTolerance, isAdditiveMode, clickQuery, boxSelectMode, activeDrawShape, onClickBufferChange, onFeatureBboxChange, justFinishedDrawingRef, wmsUrl, spatialFilter, onSpatialFilterChange, layerFilters])

  // Handle map move end - track zoom only (box select now uses click-to-confirm)
  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const mapCenter = map.getCenter()
    const mapZoom = map.getZoom()

    currentZoomRef.current = mapZoom
    // Only trigger re-render when the box-select validity threshold is crossed
    setIsBoxSelectZoomValid(mapZoom >= BOX_SELECT_MIN_ZOOM)
    onMoveEnd?.(mapCenter.lat, mapCenter.lng, mapZoom)
  }, [onMoveEnd])

  // Handle box select confirmation - calculate geographic bbox, store it, and trigger query
  const handleBoxSelectConfirm = useCallback(() => {
    if (!mapRef.current || !containerRef.current) return

    const map = mapRef.current.getMap()
    const containerRect = containerRef.current.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    const halfBox = BOX_SELECT_SIZE / 2

    // Convert screen box corners to geographic coordinates
    const sw = map.unproject([centerX - halfBox, centerY + halfBox])
    const ne = map.unproject([centerX + halfBox, centerY - halfBox])
    onBoxSelectConfirm?.({
      sw: [sw.lng, sw.lat] as [number, number],
      ne: [ne.lng, ne.lat] as [number, number]
    })

    // Query WFS layers client-side in the box area, then merge with WMS results
    const screenBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [centerX - halfBox, centerY - halfBox],
      [centerX + halfBox, centerY + halfBox]
    ]
    const wfsFeatures = queryWfsLayersInScreenBbox(map, screenBbox, visibleWfsLayers)

    if (visibleWmsLayers.length === 0) {
      dispatchFeatures(wfsFeatures, isAdditiveMode)
      return
    }

    boxSelectQuery.mutate(
      {
        visibleLayers: visibleWmsLayers,
        mapInstance: map,
        containerRect,
        boxSize: BOX_SELECT_SIZE,
        pageSize: BOX_SELECT_PAGE_SIZE,
        wmsUrl,
        layerFilters,
      },
      {
        onSuccess: ({ features: wmsFeatures, truncated }) => {
          dispatchFeatures([...wmsFeatures, ...wfsFeatures], isAdditiveMode)
          if (truncated) notifyTruncated()
        },
      }
    )
  }, [onBoxSelectConfirm, visibleWmsLayers, visibleWfsLayers, boxSelectQuery, wmsUrl, onFeatureClick, isAdditiveMode, layerFilters])

  // Handle map load
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      setStyleLoaded(true)
      onMapReady?.(map)

      // Restore query from URL if clickBufferBounds exists
      if (!hasRestoredRef.current && clickBufferBounds && onFeatureClick && hasClickableLayers) {
        hasRestoredRef.current = true

        const center = getBboxCenter(clickBufferBounds)
        const centerPoint = map.project([center.lng, center.lat])
        const swPoint = map.project([clickBufferBounds.sw[0], clickBufferBounds.sw[1]])
        const nePoint = map.project([clickBufferBounds.ne[0], clickBufferBounds.ne[1]])
        const tolerance = Math.abs(nePoint.x - swPoint.x) / 2

        // Re-emit bounds so popup opens via handleClickBufferChange
        onClickBufferChange?.(clickBufferBounds)
        queryAtPoint(map, centerPoint, tolerance || clickTolerance, false)
      }
    }
  }, [onMapReady, clickBufferBounds, onFeatureClick, hasClickableLayers, clickTolerance, clickQuery, wmsUrl, layerFilters, onClickBufferChange])

  // Combine loading states
  const showLoading = isLoading || queryLoading

  // Listen for contextmenu events on the map canvas
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const lngLat = map.unproject([x, y])

      setContextMenuCoords({
        lng: lngLat.lng,
        lat: lngLat.lat,
        screenX: e.clientX,
        screenY: e.clientY,
      })
      setContextMenuOpen(true)
    }

    const canvas = map.getCanvas()
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [styleLoaded]) // Re-run when style loads (map is ready)

  return (
    <>
      <MapContextMenu
        open={contextMenuOpen}
        onOpenChange={setContextMenuOpen}
        coords={contextMenuCoords}
        onClearSelection={onClearSelection}
        onPinLocation={onPinChange ? (coords) => onPinChange(coords) : undefined}
        hasSelection={highlightFeatures.length > 0 || !!pinCoords}
        currentZoom={currentZoomRef.current}
      />
      <div ref={containerRef} className="relative w-full h-full">
        {showLoading && !boxSelectMode && <LoadingOverlay />}

        <Map
        ref={mapRef}
        initialViewState={initialView}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        refreshExpiredTiles={false}
        onMoveEnd={handleMoveEnd}
        onClick={boxSelectMode ? undefined : handleMapClick}
        cursor={activeDrawShape !== 'off' ? 'crosshair' : boxSelectMode ? 'move' : onFeatureClick ? (isAdditiveMode ? 'copy' : 'pointer') : 'grab'}
        boxZoom={false}
        onLoad={handleLoad}
      >
        <NavigationControl position="top-left" />

        {/* View mode control - rendered before MapToolsControl so it stacks above */}
        {viewMode && onViewModeChange && (
          <ViewModeControl
            mode={viewMode}
            hasResults={hasResults}
            onModeChange={onViewModeChange}
            position="top-right"
          />
        )}

        {/* Map tools control */}
        <MapToolsControl
          drawMode={toolbarDrawShape}
          onDrawModeChange={onToolbarDrawToggle}
          onCancelMode={onCancelMode}
          hasFilter={!!spatialFilter}
          onClearFilter={onSpatialFilterChange ? () => onSpatialFilterChange(null) : undefined}
          hasPin={!!pinCoords}
          onClearPin={onPinChange ? () => onPinChange(null) : undefined}
          boxSelectActive={boxSelectMode}
          onBoxSelectToggle={onBoxSelectModeChange}
          isAdditiveMode={isAdditiveMode}
          onAdditiveModeToggle={onAdditiveModeToggle}
          position="top-right"
        />

        {/* Data layers in sidebar/config order. First = top of stack.
            Render order = top → bottom so each `beforeId` references an already-mounted layer. */}
        {renderableEntries.map((entry, i) => {
          const { layer, displayed } = entry
          const hidden = !displayed
          const opacity = layerOpacity.get(layer.title || '')
          const beforeId = i > 0 ? getLayerId(renderableEntries[i - 1].layer) : undefined
          if (isWMSLayer(layer)) {
            const cqlFilter = layerFilters[layer.title]
            const styleName = layerStyles[layer.title]
            return (
              <WmsLayerSource
                key={`${layer.title}-${cqlFilter ?? ''}-${styleName ?? ''}`}
                layer={layer}
                wmsUrl={wmsUrl}
                cqlFilter={cqlFilter}
                styleName={styleName}
                beforeId={beforeId}
                hidden={hidden}
                opacity={opacity}
              />
            )
          }
          if (isWFSLayer(layer)) {
            const sourceId = getWfsSourceId(layer)
            const geojson = wfsLayerData.get(sourceId)!
            return (
              <WfsLayerSource
                key={sourceId}
                layer={layer}
                geojson={geojson}
                beforeId={beforeId}
                layerFilter={vectorLayerFilters[layer.title]}
                activeSymbology={vectorLayerSymbology[layer.title] || ''}
                hidden={hidden}
                opacity={opacity}
              />
            )
          }
          if (isArcGISMapServerLayer(layer)) {
            return <ArcGisLayerSource key={layer.title} layer={layer} beforeId={beforeId} hidden={hidden} opacity={opacity} />
          }
          if (isCOGLayer(layer)) {
            return <CogLayerSource key={layer.title} layer={layer} beforeId={beforeId} hidden={hidden} opacity={opacity} />
          }
          if (isPMTilesLayer(layer)) {
            const fragment = pmtilesFragments.get(layer.title || '')!
            const activeSymbology = vectorLayerSymbology[layer.title] || ''
            return (
              <PMTilesLayerSource
                key={`${layer.title}-${activeSymbology}`}
                layer={layer}
                fragment={fragment}
                activeSymbology={activeSymbology}
                beforeId={beforeId}
                layerFilter={vectorLayerFilters[layer.title]}
                hidden={hidden}
                opacity={opacity}
              />
            )
          }
          return null
        })}

        {/* Highlight layers */}
        <HighlightLayers features={highlightFeatures} />

        {/* Spatial filter visualization */}
        <SpatialFilterLayer filter={spatialFilter} />

        {/* Click buffer visualization — vector click tolerance area; suppressed when only raster active */}
        {clickBufferBounds && hasVectorClickTarget && <ClickBufferLayer bounds={clickBufferBounds} />}

        {/* Pixel cell highlight per visible COG layer — shows actual sampled pixel */}
        {visibleCogLayers.map(layer => (
          <CogPixelHighlight key={`pixel-${layer.title}`} layer={layer} clickPoint={cogClickPoint} />
        ))}

        {/* Frozen box select bounds visualization */}
        {boxSelectBounds && <ClickBufferLayer bounds={boxSelectBounds} />}

        {/* Pin marker from shared link or context menu */}
        {pinCoords && (
          <Marker key={`${pinCoords.lat},${pinCoords.lon}`} longitude={pinCoords.lon} latitude={pinCoords.lat} anchor="bottom">
            <svg width="22" height="34" viewBox="0 0 22 34" className="drop-shadow-md animate-in zoom-in-0 duration-300 origin-bottom">
              <path
                d="M11 0C4.925 0 0 4.925 0 11c0 9 11 23 11 23s11-14 11-23C22 4.925 17.075 0 11 0z"
                className="fill-primary"
              />
              <circle cx="11" cy="11" r="4" className="fill-primary-foreground" />
            </svg>
          </Marker>
        )}

        {children}
      </Map>

        {/* Box select overlay - only show when in box select mode AND no frozen bounds yet */}
        {boxSelectMode && !boxSelectBounds && (
          <BoxSelectOverlay
            isLoading={boxSelectQuery.isPending}
            boxSize={BOX_SELECT_SIZE}
            isZoomValid={isBoxSelectZoomValid}
            minZoom={BOX_SELECT_MIN_ZOOM}
            onConfirm={handleBoxSelectConfirm}
          />
        )}
      </div>
    </>
  )
}
