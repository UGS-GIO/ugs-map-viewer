import { useRef, useMemo, useCallback, useState, useEffect, type RefObject } from 'react'
import { useWfsLayerData, getWfsSourceId, queryWfsLayersInScreenBbox, queryWfsLayersAtPoint, type WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import Map, { AttributionControl, Source, Layer, Marker, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import { useIsMobile } from '@/hooks/use-mobile'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  DEFAULT_CLICK_TOLERANCE,
  BOX_SELECT_SIZE,
  BOX_SELECT_PAGE_SIZE,
  BOX_SELECT_MIN_ZOOM,
} from './constants'
import { BASEMAP_STYLES, DEFAULT_BASEMAP, buildBasemapStyle } from '@/lib/basemaps'
import { BoxSelectOverlay, ViewModeControl, MapToolsControl, MeasureToolsControl } from './controls'
import { HighlightLayers, HoverHighlightLayer, SpatialFilterLayer, ClickBufferLayer } from './layers'
import { flattenDataLayersWithAncestors, resolveLeafVisibility, isWMSLayer, isWFSLayer, isArcGISMapServerLayer, isCOGLayer, isPMTilesLayer, buildWmsTileUrl, buildArcGisExportUrl, getWmsLayerName, zoomRangeToBounds, isWithinZoomRange, effectiveZoomRange } from '@/lib/map/layer-utils'
import { useLayerUrl } from '@/context/layer-url-provider'
import { PMTilesLayerSource, usePMTilesStyleFragments, getPmtilesLayerId, queryPmtilesLayersAtPoint, queryPmtilesLayersInScreenBbox } from '@/components/maps/pmtiles-layer-source'
import type { WMSLayerProps, WFSLayerProps, ArcGISMapServerLayerProps, COGLayerProps, PMTilesLayerProps } from '@/lib/types/mapping-types'
import type * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'

import { useCogRange } from '@/hooks/use-cog-metadata'
import { CogPixelHighlight } from '@/components/maps/cog-pixel-highlight'
import { buildCogProtocolUrl } from '@/lib/map/cog/setup'
import { boundsToPolygon, calculateBboxFromGeometry, polygonBounds, screenBoxToPolygon } from '@/lib/map/geometry-utils'
import { formatArea, formatBbox } from '@/lib/map/url-geometry'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import { useTerraDraw } from '@/hooks/use-terra-draw'
import type { Polygon } from 'geojson'
import { bbox as turfBbox } from '@turf/bbox'
import { useFeatureQuery } from '@/hooks/use-feature-query'
import type { ClickedFeature, DataMapProps } from './types'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { MapContextMenu, type ContextMenuCoords } from './map-context-menu'
import { toast } from 'sonner'
import { Terrain3D, Hillshade, MAX_PITCH, SKY } from './terrain-layers'
import { useMeasureMode } from '@/hooks/use-measure'

// Re-export types for consumers
export type { DrawMode, SpatialFilter, HighlightFeature, ClickedFeature, DataMapProps, PMTilesStyleOverride } from './types'

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

/**
 * Keeps a selection in step with its URL value: re-queries it on load and Back/Forward, clears it when
 * gone. Local actions call the returned mark with the value they write, so it isn't re-run.
 */
function useFollowUrl<T>(
  mapRef: RefObject<MapRef | null>,
  enabled: boolean,
  value: T | null | undefined,
  key: string | undefined,
  clear: () => void,
  query: (map: maplibregl.Map, value: T) => void,
) {
  // null: a pending query was cancelled, so whatever the URL holds next has to run
  const queried = useRef<string | null | undefined>(undefined)
  const latest = useRef({ value, clear, query })
  latest.current = { value, clear, query }
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!enabled || !map || key === queried.current) return
    queried.current = key
    const { value, clear } = latest.current
    if (!value) return clear()
    // After idle, so the camera Back/Forward moves to has settled and its tiles are drawn
    let ran = false
    const run = () => {
      ran = true
      latest.current.query(map, value)
    }
    map.once('idle', run)
    return () => {
      if (ran) return
      map.off('idle', run)
      queried.current = null
    }
  }, [mapRef, enabled, key])
  return useCallback((written: string | undefined) => { queried.current = written }, [])
}

/** WMS layers that MapLibre draws at the map's current zoom and center. */
function wmsLayersDrawnInView(map: maplibregl.Map, layers: WMSLayerProps[]): WMSLayerProps[] {
  const zoom = map.getZoom()
  const latitude = map.getCenter().lat
  return layers.filter(l => isWithinZoomRange(effectiveZoomRange(l, latitude), zoom))
}

function WmsLayerSource({
  layer, wmsUrl, cqlFilter, styleName, zoomRange, beforeId, hidden, opacity,
}: {
  layer: WMSLayerProps
  wmsUrl: string
  cqlFilter: string | undefined
  styleName: string | undefined
  zoomRange: [number, number] | undefined
  beforeId: string | undefined
  hidden?: boolean
  opacity?: number
}) {
  const layerName = getWmsLayerName(layer)
  const layerWmsUrl = layer.url || wmsUrl
  const tileUrl = buildWmsTileUrl(layerWmsUrl, layerName, cqlFilter, layer.customLayerParameters, styleName)
  // The zoom range gates the raster the same way `visibleZoomRange` gates PMTiles,
  // so Township & Range (WMS) comes in at the zoom its Sections sibling does.
  return (
    <Source id={`wms-${layer.title}`} type="raster" tiles={[tileUrl]} tileSize={512}>
      <Layer
        id={`wms-layer-${layer.title}`}
        beforeId={beforeId}
        type="raster"
        {...zoomRangeToBounds(zoomRange)}
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
  pitch,
  bearing,
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
  pmtilesStyleOverrides = {},
  onMapReady,
  basemapId,
  terrain,
  exaggeration,
  clickBufferBounds,
  onClickBufferChange,
  initialBounds,
  onFeatureBboxChange,
  onClearSelection,
  hasSelection = false,
  pinCoords,
  onPinChange,
  viewMode,
  onViewModeChange,
  hasResults = false,
}: DataMapProps) {
  const mapRef = useRef<MapRef>(null)
  const { measure: measureMode } = useMeasureMode()
  const isMobile = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)

  // Track current zoom via ref (avoids full DataMap re-render on every moveend)
  const currentZoomRef = useRef(zoom)
  const [isBoxSelectZoomValid, setIsBoxSelectZoomValid] = useState(zoom >= BOX_SELECT_MIN_ZOOM)
  const [styleLoaded, setStyleLoaded] = useState(false)

  // Context menu state
  const [contextMenuCoords, setContextMenuCoords] = useState<ContextMenuCoords | null>(null)
  // Scale-capped layers (`maxScale`) need the center latitude to place their maxzoom.
  const [viewLatitude, setViewLatitude] = useState(center[1])
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
  // `queryable: false` opts a layer out of click queries, the same flag WFS and raster already
  // honour. Tiles clip geometry at their edges, so a clicked polygon highlights as the tile-shaped
  // fragment the query returned; a layer can turn selection off until that's solved centrally.
  const visiblePmtilesLayers = useMemo(
    () => mountedPmtilesLayers.filter(l => {
      if (!displayedTitles.has(l.title || '')) return false
      const subs = l.sublayers ?? []
      return subs.length === 0 || subs.some(sub => sub.queryable !== false)
    }),
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

  // Only scale-capped layers depend on latitude, so skip the re-render otherwise.
  // Rounded to 0.001 degrees, well under one unit of the footer's 1:X readout.
  const syncViewLatitude = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !visibleWmsLayersRef.current.some(l => l.maxScale !== undefined)) return
    setViewLatitude(Math.round(map.getCenter().lat * 1000) / 1000)
  }, [])
  useEffect(() => {
    if (styleLoaded) syncViewLatitude()
  }, [styleLoaded, visibleWmsLayers, syncViewLatitude])
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
        onFeatureClick(allFeatures, { additive: false, highlightAll: true })
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
    options: { extractBbox?: boolean; clearOnEmpty?: boolean; highlightAll?: boolean } = {}
  ) {
    if (features.length > 0) {
      onFeatureClick?.(features, { additive, highlightAll: options.highlightAll })
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
    // A WMS layer outside its zoom range isn't drawn, so it isn't clickable either.
    const wmsLayersAtZoom = wmsLayersDrawnInView(map, visibleWmsLayersRef.current)

    if (wmsLayersAtZoom.length === 0) {
      dispatchFeatures(vectorFeatures, additive, options)
      return
    }

    clickQuery.mutate(
      {
        point,
        visibleLayers: wmsLayersAtZoom,
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

  // Client-side vector features inside a ground polygon's bounding box, as it's drawn now
  function vectorFeaturesIn(map: maplibregl.Map, polygon: Polygon): WfsLayerFeature[] {
    const [minX, minY, maxX, maxY] = turfBbox(polygon)
    const sw = map.project([minX, minY])
    const ne = map.project([maxX, maxY])
    const screenBbox: [maplibregl.PointLike, maplibregl.PointLike] = [[sw.x, ne.y], [ne.x, sw.y]]
    return [
      ...queryPmtilesLayersInScreenBbox(map, screenBbox, visiblePmtilesLayersRef.current),
      ...queryWfsLayersInScreenBbox(map, screenBbox, visibleWfsLayersRef.current),
    ]
  }

  // Query vector + WMS features inside a drawn area.
  // Uses refs for visible layers and polygonQuery to keep callbacks stable (prevents TerraDraw reinit)
  const queryArea = useCallback((map: maplibregl.Map, polygon: Polygon) => {
    const wmsLayers = wmsLayersDrawnInView(map, visibleWmsLayersRef.current)
    const vectorFeatures = vectorFeaturesIn(map, polygon)

    // If no WMS layers, just use the vector results directly
    if (wmsLayers.length === 0) {
      if (vectorFeatures.length > 0 && onFeatureClick) {
        onFeatureClick(vectorFeatures, { additive: false, highlightAll: true })
      }
      return
    }

    // Store vector features for merging when WMS query completes
    polygonWfsLayerFeaturesRef.current = vectorFeatures
    polygonQueryRef.current.mutate({ polygon, visibleLayers: wmsLayers, wmsUrl, layerFilters })
  }, [wmsUrl, onFeatureClick, layerFilters])

  const clearSelection = useCallback(() => onFeatureClick?.([]), [onFeatureClick])
  const followReady = styleLoaded && !!onFeatureClick
  const markClickQueried = useFollowUrl(mapRef, followReady && hasClickableLayers, clickBufferBounds, formatBbox(clickBufferBounds), clearSelection, (map, bounds) => {
    const center = getBboxCenter(bounds)
    const swPoint = map.project([bounds.sw[0], bounds.sw[1]])
    const nePoint = map.project([bounds.ne[0], bounds.ne[1]])
    // Re-emit bounds so popup opens via handleClickBufferChange
    onClickBufferChange?.(bounds)
    queryAtPoint(map, map.project([center.lng, center.lat]), Math.abs(nePoint.x - swPoint.x) / 2 || clickTolerance, false)
  })
  const markAreaQueried = useFollowUrl(mapRef, followReady, spatialFilter, formatArea(spatialFilter), clearSelection, queryArea)
  const markBoxQueried = useFollowUrl(mapRef, followReady, boxSelectBounds, formatBbox(boxSelectBounds), clearSelection, (map, bounds) => {
    const sw = map.project(bounds.sw)
    const ne = map.project(bounds.ne)
    queryBox(map, boundsToPolygon(bounds), [[sw.x, ne.y], [ne.x, sw.y]], false)
  })

  const setArea = useCallback((polygon: Polygon | null) => {
    markAreaQueried(formatArea(polygon))
    // A new area drops click_bbox with the old selection; the click follower mustn't clear the area's results
    if (polygon) markClickQueried(formatBbox(null))
    onSpatialFilterChange?.(polygon)
    const map = mapRef.current?.getMap()
    if (polygon && map) queryArea(map, polygon)
  }, [markAreaQueried, markClickQueried, onSpatialFilterChange, queryArea])

  // Route drawn polygons: external caller consumes (returns true), otherwise spatial filter
  const handleDrawFinished = useCallback((polygon: Polygon) => {
    if (onDrawComplete && onDrawComplete(polygon)) return
    setArea(polygon)
  }, [onDrawComplete, setArea])

  const { justFinishedDrawingRef } = useTerraDraw({
    map: mapInstance,
    styleLoaded,
    activeDrawShape,
    onDrawReset,
    onDrawFinished: handleDrawFinished,
  })

  // Initial view: the URL's camera, or a link's selection when it has no camera
  const initialViewRef = useRef<{
    longitude?: number
    latitude?: number
    zoom?: number
    pitch?: number
    bearing?: number
    bounds?: [[number, number], [number, number]]
    fitBoundsOptions?: { padding: number; maxZoom?: number }
  } | null>(null)
  if (!initialViewRef.current) {
    if (initialBounds) {
      initialViewRef.current = {
        bounds: [initialBounds.sw, initialBounds.ne],
        fitBoundsOptions: { padding: 50, maxZoom: 14 },
        pitch,
        bearing,
      }
    } else {
      initialViewRef.current = { longitude: center[0], latitude: center[1], zoom, pitch, bearing }
    }
  }
  const initialView = initialViewRef.current

  // Build basemap style from URL param or default
  const currentBasemap = useMemo(
    () => BASEMAP_STYLES.find((b) => b.id === (basemapId ?? DEFAULT_BASEMAP.id)) || DEFAULT_BASEMAP,
    [basemapId]
  )

  const mapStyle = useMemo(() => buildBasemapStyle(currentBasemap), [currentBasemap])

  // Handle map click - triggers mutation instead of direct fetch
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (boxSelectMode || activeDrawShape !== 'off' || measureMode) return
    if (justFinishedDrawingRef.current) {
      justFinishedDrawingRef.current = false
      return
    }
    if (!onFeatureClick || !hasClickableLayers) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Clear any existing spatial filter when doing a regular click
    if (spatialFilter) setArea(null)

    // Calculate click buffer bbox for visualization
    const clickBounds = polygonBounds(screenBoxToPolygon(map, [e.point.x - clickTolerance, e.point.y - clickTolerance], [e.point.x + clickTolerance, e.point.y + clickTolerance]))
    markClickQueried(formatBbox(clickBounds))
    onClickBufferChange?.(clickBounds)

    const isAdditive = isAdditiveMode || (e.originalEvent?.shiftKey ?? false)
    queryAtPoint(map, e.point, clickTolerance, isAdditive, { extractBbox: true, clearOnEmpty: true })
  }, [markClickQueried, onFeatureClick, hasClickableLayers, clickTolerance, isAdditiveMode, clickQuery, boxSelectMode, activeDrawShape, measureMode, onClickBufferChange, onFeatureBboxChange, justFinishedDrawingRef, wmsUrl, spatialFilter, setArea, layerFilters])

  // Handle map move end - track zoom only (box select now uses click-to-confirm)
  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const mapCenter = map.getCenter()
    const mapZoom = map.getZoom()

    currentZoomRef.current = mapZoom
    syncViewLatitude()
    // Only trigger re-render when the box-select validity threshold is crossed
    setIsBoxSelectZoomValid(mapZoom >= BOX_SELECT_MIN_ZOOM)
    onMoveEnd?.(mapCenter.lat, mapCenter.lng, mapZoom, map.getPitch(), map.getBearing())
  }, [onMoveEnd, syncViewLatitude])

  // Query vector + WMS features in a box. The vector query takes the box on screen, the WMS one on the ground.
  function queryBox(map: maplibregl.Map, box: Polygon, screenBbox: [maplibregl.PointLike, maplibregl.PointLike], additive: boolean) {
    const vectorFeatures = [
      ...queryPmtilesLayersInScreenBbox(map, screenBbox, visiblePmtilesLayersRef.current),
      ...queryWfsLayersInScreenBbox(map, screenBbox, visibleWfsLayersRef.current),
    ]
    const wmsLayersAtZoom = wmsLayersDrawnInView(map, visibleWmsLayersRef.current)
    if (wmsLayersAtZoom.length === 0) {
      dispatchFeatures(vectorFeatures, additive, { highlightAll: true })
      return
    }
    boxSelectQuery.mutate(
      { visibleLayers: wmsLayersAtZoom, box, pageSize: BOX_SELECT_PAGE_SIZE, wmsUrl, layerFilters },
      {
        onSuccess: ({ features: wmsFeatures, truncated }) => {
          dispatchFeatures([...wmsFeatures, ...vectorFeatures], additive, { highlightAll: true })
          if (truncated) notifyTruncated()
        },
      }
    )
  }

  // Handle box select confirmation - query the centered box and store its bounds
  const handleBoxSelectConfirm = useCallback(() => {
    if (!mapRef.current || !containerRef.current) return

    const map = mapRef.current.getMap()
    const containerRect = containerRef.current.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    const halfBox = BOX_SELECT_SIZE / 2
    const box = screenBoxToPolygon(map, [centerX - halfBox, centerY - halfBox], [centerX + halfBox, centerY + halfBox])
    const bounds = polygonBounds(box)

    markBoxQueried(formatBbox(bounds))
    // The box replaces a click selection, so its step mustn't carry the click's bbox too
    markClickQueried(formatBbox(null))
    onClickBufferChange?.(null)
    onBoxSelectConfirm?.(bounds)
    queryBox(map, box, [[centerX - halfBox, centerY - halfBox], [centerX + halfBox, centerY + halfBox]], isAdditiveMode)
  }, [markBoxQueried, markClickQueried, onBoxSelectConfirm, onClickBufferChange, visibleWmsLayers, visibleWfsLayers, visiblePmtilesLayers, boxSelectQuery, wmsUrl, onFeatureClick, isAdditiveMode, layerFilters])

  // Handle map load
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      setStyleLoaded(true)
      onMapReady?.(map)
    }
  }, [onMapReady])

  // Combine loading states
  const showLoading = isLoading || queryLoading

  // The context menu's clear also takes the pin; the toolbar keeps the two separate.
  const clearSelectionAndPin = useMemo(() => onClearSelection && (() => {
    onClearSelection()
    onPinChange?.(null)
  }), [onClearSelection, onPinChange])

  // MapLibre's contextmenu waits for mouseup and skips right-drags, so tilting/rotating doesn't open the menu
  const handleContextMenu = useCallback((e: MapLayerMouseEvent) => {
    setContextMenuCoords({
      lng: e.lngLat.lng,
      lat: e.lngLat.lat,
      screenX: e.originalEvent.clientX,
      screenY: e.originalEvent.clientY,
    })
    setContextMenuOpen(true)
  }, [])

  return (
    <>
      <MapContextMenu
        open={contextMenuOpen}
        onOpenChange={setContextMenuOpen}
        coords={contextMenuCoords}
        onClearSelection={clearSelectionAndPin}
        onPinLocation={onPinChange ? (coords) => onPinChange(coords) : undefined}
        hasSelection={hasSelection || !!pinCoords}
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
        cursor={activeDrawShape !== 'off' || measureMode ? 'crosshair' : boxSelectMode ? 'move' : onFeatureClick ? (isAdditiveMode ? 'copy' : 'pointer') : 'grab'}
        boxZoom={false}
        attributionControl={false}
        maxPitch={MAX_PITCH}
        sky={SKY}
        onLoad={handleLoad}
        onContextMenu={handleContextMenu}
      >
        {/* Phones keep bottom-right for locate-me, in thumb reach, as Google Maps does. */}
        <AttributionControl compact={isMobile || undefined} position={isMobile ? 'bottom-left' : 'bottom-right'} />

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
          onClearFilter={onSpatialFilterChange ? () => setArea(null) : undefined}
          hasPin={!!pinCoords}
          onClearPin={onPinChange ? () => onPinChange(null) : undefined}
          hasSelection={hasSelection}
          onClearSelection={onClearSelection}
          boxSelectActive={boxSelectMode}
          onBoxSelectToggle={onBoxSelectModeChange}
          isAdditiveMode={isAdditiveMode}
          onAdditiveModeToggle={onAdditiveModeToggle}
          position="top-right"
        />

        {/* Rendered after MapToolsControl so it stacks below as its own group */}
        <MeasureToolsControl />

        {/* Data layers in sidebar/config order. First = top of stack.
            Render order = top → bottom so each `beforeId` references an already-mounted layer. */}
        {renderableEntries.map((entry, i) => {
          const { layer, displayed } = entry
          const hidden = !displayed
          const opacity = layerOpacity.get(layer.title || '')
          const beforeId = i > 0 ? getLayerId(renderableEntries[i - 1].layer) : undefined
          if (isWMSLayer(layer)) {
            const cqlFilter = layerFilters[layer.title]
            const styleName = layerStyles[layer.title] ?? layer.styleName
            return (
              <WmsLayerSource
                key={`${layer.title}-${cqlFilter ?? ''}-${styleName ?? ''}`}
                layer={layer}
                wmsUrl={wmsUrl}
                cqlFilter={cqlFilter}
                styleName={styleName}
                zoomRange={effectiveZoomRange(layer, viewLatitude)}
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
            const title = layer.title || ''
            const activeSymbology = title ? vectorLayerSymbology[title] || '' : ''
            const styleOverride = title ? pmtilesStyleOverrides[title] : undefined
            return (
              <PMTilesLayerSource
                key={`${title}-${activeSymbology}`}
                layer={layer}
                fragment={fragment}
                activeSymbology={activeSymbology}
                beforeId={beforeId}
                layerFilter={title ? vectorLayerFilters[title] : undefined}
                hidden={hidden}
                opacity={opacity}
                styleOverride={styleOverride}
              />
            )
          }
          return null
        })}

        {terrain && <Terrain3D exaggeration={exaggeration} />}
        {/* After the data layers so they're mounted when the hillshade looks for the bottom one */}
        {terrain && <Hillshade bottomDataLayerId={renderableEntries.length ? getLayerId(renderableEntries[renderableEntries.length - 1].layer) : undefined} />}

        {/* Highlight layers */}
        <HighlightLayers features={highlightFeatures} />
        <HoverHighlightLayer />

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
