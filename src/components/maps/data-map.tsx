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
import { flattenWmsLayers, flattenWfsLayers, flattenArcGisLayers, buildWmsTileUrl, buildArcGisExportUrl, getWmsLayerName } from '@/lib/map/layer-utils'
import type maplibregl from 'maplibre-gl'

import { calculateBboxFromGeometry } from '@/lib/map/geometry-utils'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import { useTerraDraw } from '@/hooks/use-terra-draw'
import type { Polygon } from 'geojson'
import { bbox as turfBbox } from '@turf/bbox'
import { useFeatureQuery } from '@/hooks/use-feature-query'
import type { DataMapProps } from './types'
import { LoadingOverlay } from '@/components/ui/loading-spinner'
import { MapContextMenu, type ContextMenuCoords } from './map-context-menu'

// Re-export types for consumers
export type { DrawMode, SpatialFilter, HighlightFeature, ClickedFeature, DataMapProps } from './types'

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

  // Get visible layers - flatten groups recursively (defined early for use in callbacks)
  const visibleWmsLayers = useMemo(() => flattenWmsLayers(layers), [layers])
  const visibleWfsLayers = useMemo(() => flattenWfsLayers(layers), [layers])
  const visibleArcGisLayers = useMemo(() => flattenArcGisLayers(layers), [layers])

  // Reverse for MapLibre draw order: first in config (top of sidebar) should draw on top.
  // MapLibre draws later layers on top, so we reverse so config-first renders last.
  const wmsDrawOrder = useMemo(() => [...visibleWmsLayers].reverse(), [visibleWmsLayers])
  const wfsDrawOrder = useMemo(() => [...visibleWfsLayers].reverse(), [visibleWfsLayers])
  const arcGisDrawOrder = useMemo(() => [...visibleArcGisLayers].reverse(), [visibleArcGisLayers])

  // Fetch WFS layer data using TanStack Query (automatic caching, retries, deduplication)
  const { data: wfsLayerData } = useWfsLayerData(visibleWfsLayers)

  // Refs for stable access to layers in callbacks (prevents TerraDraw reinit)
  const visibleWmsLayersRef = useRef(visibleWmsLayers)
  visibleWmsLayersRef.current = visibleWmsLayers
  const visibleWfsLayersRef = useRef(visibleWfsLayers)
  visibleWfsLayersRef.current = visibleWfsLayers

  // Ref to store WFS features from polygon query (populated before WMS query completes)
  const polygonWfsLayerFeaturesRef = useRef<WfsLayerFeature[]>([])

  // Feature query mutations
  const { clickQuery, boxSelectQuery, polygonQuery, isLoading: queryLoading } = useFeatureQuery({
    onPolygonQuerySuccess: (wmsFeatures) => {
      // Merge WMS results with pre-queried WFS features
      const allFeatures = [...wmsFeatures, ...polygonWfsLayerFeaturesRef.current]
      polygonWfsLayerFeaturesRef.current = [] // Clear for next query
      if (onFeatureClick && allFeatures.length > 0) {
        onFeatureClick(allFeatures, { additive: false })
      }
    },
  })

  // Ref for stable access to polygonQuery mutation (prevents callback reference changes)
  const polygonQueryRef = useRef(polygonQuery)
  polygonQueryRef.current = polygonQuery

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
    // Allow click if there are WMS or WFS layers
    if (!onFeatureClick || (visibleWmsLayers.length === 0 && visibleWfsLayers.length === 0)) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Clear any existing spatial filter when doing a regular click
    if (spatialFilter) {
      onSpatialFilterChange?.(null)
    }

    // Calculate click buffer bbox for visualization
    const sw = map.unproject([e.point.x - clickTolerance, e.point.y + clickTolerance])
    const ne = map.unproject([e.point.x + clickTolerance, e.point.y - clickTolerance])
    onClickBufferChange?.({ sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat] })

    const isAdditive = isAdditiveMode || (e.originalEvent?.shiftKey ?? false)

    // Query WFS layers client-side (already rendered on map)
    const wfsFeatures = queryWfsLayersAtPoint(map, e.point, clickTolerance, visibleWfsLayers)

    // If no WMS layers, just use WFS results directly
    if (visibleWmsLayers.length === 0) {
      if (wfsFeatures.length > 0) {
        onFeatureClick(wfsFeatures, { additive: isAdditive })
        const firstFeature = wfsFeatures.find(f => f.geometry)
        if (firstFeature?.geometry && onFeatureBboxChange) {
          const bbox = calculateBboxFromGeometry(firstFeature.geometry)
          if (bbox) {
            onFeatureBboxChange({ sw: [bbox[0], bbox[1]], ne: [bbox[2], bbox[3]] })
          }
        }
      } else if (!isAdditive) {
        onFeatureClick([], { additive: false })
        onFeatureBboxChange?.(null)
      }
      return
    }

    // Query WMS layers via WFS, then merge with client-side WFS results
    clickQuery.mutate(
      {
        point: { x: e.point.x, y: e.point.y },
        visibleLayers: visibleWmsLayers,
        tolerance: clickTolerance,
        mapInstance: map,
        wmsUrl,
        layerFilters,
      },
      {
        onSuccess: (wmsFeatures) => {
          // Merge WMS and WFS layer results
          const allFeatures = [...wmsFeatures, ...wfsFeatures]

          if (allFeatures.length > 0) {
            onFeatureClick(allFeatures, { additive: isAdditive })

            const firstFeature = allFeatures.find(f => f.geometry)
            if (firstFeature?.geometry && onFeatureBboxChange) {
              const bbox = calculateBboxFromGeometry(firstFeature.geometry)
              if (bbox) {
                onFeatureBboxChange({ sw: [bbox[0], bbox[1]], ne: [bbox[2], bbox[3]] })
              }
            }
          } else if (!isAdditive) {
            onFeatureClick([], { additive: false })
            onFeatureBboxChange?.(null)
          }
        },
      }
    )
  }, [onFeatureClick, visibleWmsLayers, visibleWfsLayers, clickTolerance, isAdditiveMode, clickQuery, boxSelectMode, activeDrawShape, onClickBufferChange, onFeatureBboxChange, justFinishedDrawingRef, wmsUrl, spatialFilter, onSpatialFilterChange, layerFilters])

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

    // Calculate box center in screen coordinates
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    const halfBox = BOX_SELECT_SIZE / 2

    // Convert screen box corners to geographic coordinates
    const sw = map.unproject([centerX - halfBox, centerY + halfBox])
    const ne = map.unproject([centerX + halfBox, centerY - halfBox])

    const bounds = {
      sw: [sw.lng, sw.lat] as [number, number],
      ne: [ne.lng, ne.lat] as [number, number]
    }

    // Notify parent to store frozen bounds (for visualization)
    onBoxSelectConfirm?.(bounds)

    // Query WFS layers in the box area client-side
    const screenBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [centerX - halfBox, centerY - halfBox],
      [centerX + halfBox, centerY + halfBox]
    ]
    const wfsFeatures = queryWfsLayersInScreenBbox(map, screenBbox, visibleWfsLayers)

    // If no WMS layers, just use WFS results directly
    if (visibleWmsLayers.length === 0 && onFeatureClick) {
      if (wfsFeatures.length > 0) {
        onFeatureClick(wfsFeatures, { additive: isAdditiveMode })
      }
      return
    }

    // Trigger the query with the frozen bbox, then merge WFS results
    if (visibleWmsLayers.length > 0 && onFeatureClick) {
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
          onSuccess: (wmsFeatures) => {
            const allFeatures = [...wmsFeatures, ...wfsFeatures]
            if (allFeatures.length > 0) {
              // Use current isAdditiveMode value (not stale closure)
              onFeatureClick(allFeatures, { additive: isAdditiveMode })
            }
          },
        }
      )
    }
  }, [onBoxSelectConfirm, visibleWmsLayers, visibleWfsLayers, boxSelectQuery, wmsUrl, onFeatureClick, isAdditiveMode, layerFilters])

  // Handle map load
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      setStyleLoaded(true)
      onMapReady?.(map)

      // Restore query from URL if clickBufferBounds exists
      const hasLayers = visibleWmsLayers.length > 0 || visibleWfsLayers.length > 0
      if (!hasRestoredRef.current && clickBufferBounds && onFeatureClick && hasLayers) {
        hasRestoredRef.current = true

        const center = getBboxCenter(clickBufferBounds)
        const centerPoint = map.project([center.lng, center.lat])

        const swPoint = map.project([clickBufferBounds.sw[0], clickBufferBounds.sw[1]])
        const nePoint = map.project([clickBufferBounds.ne[0], clickBufferBounds.ne[1]])
        const tolerance = Math.abs(nePoint.x - swPoint.x) / 2

        // Query WFS layers client-side
        const wfsFeatures = queryWfsLayersAtPoint(map, centerPoint, tolerance || clickTolerance, visibleWfsLayers)

        // If no WMS layers, just use WFS results directly
        if (visibleWmsLayers.length === 0) {
          if (wfsFeatures.length > 0) {
            onFeatureClick(wfsFeatures, { additive: false })
          }
          return
        }

        // Query WMS layers via WFS, then merge
        clickQuery.mutate(
          {
            point: { x: centerPoint.x, y: centerPoint.y },
            visibleLayers: visibleWmsLayers,
            tolerance: tolerance || clickTolerance,
            mapInstance: map,
            wmsUrl,
            layerFilters,
          },
          {
            onSuccess: (wmsFeatures) => {
              const allFeatures = [...wmsFeatures, ...wfsFeatures]
              if (allFeatures.length > 0) {
                onFeatureClick(allFeatures, { additive: false })
              }
            },
          }
        )
      }
    }
  }, [onMapReady, clickBufferBounds, onFeatureClick, visibleWmsLayers, visibleWfsLayers, clickTolerance, clickQuery, wmsUrl, layerFilters])

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

  const handleQueryHere = useCallback((coords: { lng: number; lat: number }) => {
    const map = mapRef.current?.getMap()
    if (!map || !onFeatureClick || (visibleWmsLayers.length === 0 && visibleWfsLayers.length === 0)) return

    const point = map.project([coords.lng, coords.lat])

    // Calculate click buffer bbox for visualization
    const sw = map.unproject([point.x - clickTolerance, point.y + clickTolerance])
    const ne = map.unproject([point.x + clickTolerance, point.y - clickTolerance])
    onClickBufferChange?.({ sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat] })

    // Query WFS layers client-side
    const wfsFeatures = queryWfsLayersAtPoint(map, point, clickTolerance, visibleWfsLayers)

    // If no WMS layers, just use WFS results directly
    if (visibleWmsLayers.length === 0) {
      if (wfsFeatures.length > 0) {
        onFeatureClick(wfsFeatures, { additive: false })
      }
      return
    }

    // Query WMS layers via WFS, then merge
    clickQuery.mutate(
      {
        point: { x: point.x, y: point.y },
        visibleLayers: visibleWmsLayers,
        tolerance: clickTolerance,
        mapInstance: map,
        wmsUrl,
        layerFilters,
      },
      {
        onSuccess: (wmsFeatures) => {
          const allFeatures = [...wmsFeatures, ...wfsFeatures]
          if (allFeatures.length > 0) {
            onFeatureClick(allFeatures, { additive: false })
          }
        },
      }
    )
  }, [visibleWmsLayers, visibleWfsLayers, clickTolerance, clickQuery, wmsUrl, onFeatureClick, onClickBufferChange, layerFilters])

  const handleZoomIn = useCallback((coords: { lng: number; lat: number }) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.flyTo({ center: [coords.lng, coords.lat], zoom: map.getZoom() + 2 })
  }, [])

  const handleZoomOut = useCallback((coords: { lng: number; lat: number }) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.flyTo({ center: [coords.lng, coords.lat], zoom: Math.max(0, map.getZoom() - 2) })
  }, [])

  const handleCenterHere = useCallback((coords: { lng: number; lat: number }) => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.flyTo({ center: [coords.lng, coords.lat] })
  }, [])

  return (
    <>
      <MapContextMenu
        open={contextMenuOpen}
        onOpenChange={setContextMenuOpen}
        coords={contextMenuCoords}
        onQueryHere={onFeatureClick ? handleQueryHere : undefined}
        onClearSelection={onClearSelection}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterHere={handleCenterHere}
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

        {/* ArcGIS MapServer Layers (reversed so config-first = drawn on top) */}
        {arcGisDrawOrder.map((layer) => (
          <Source
            key={layer.title}
            id={`arcgis-${layer.title}`}
            type="raster"
            tiles={[buildArcGisExportUrl(layer.url)]}
            tileSize={512}
          >
            <Layer
              id={`arcgis-layer-${layer.title}`}
              type="raster"
              paint={{ 'raster-opacity': layer.opacity ?? 0.8 }}
              metadata={{
                title: layer.title,
                'arcgis-url': layer.url,
              }}
            />
          </Source>
        ))}

        {/* WMS Layers (reversed so config-first = drawn on top) */}
        {wmsDrawOrder.map((layer) => {
          const layerName = getWmsLayerName(layer)
          const cqlFilter = layerFilters[layer.title]
          const layerWmsUrl = layer.url || wmsUrl
          const tileUrl = buildWmsTileUrl(layerWmsUrl, layerName, cqlFilter, layer.customLayerParameters)

          return (
            <Source
              key={`${layer.title}-${cqlFilter ?? ''}`}
              id={`wms-${layer.title}`}
              type="raster"
              tiles={[tileUrl]}
              tileSize={512}
            >
              <Layer
                id={`wms-layer-${layer.title}`}
                type="raster"
                paint={{ 'raster-opacity': layer.opacity ?? 0.8 }}
                // Metadata for findLayerByTitle and legend provider
                metadata={{
                  title: layer.title,
                  'wms-url': layerWmsUrl,
                  'wms-layer': layerName,
                }}
              />
            </Source>
          )
        })}

        {/* WFS Layers (reversed so config-first = drawn on top) */}
        {wfsDrawOrder.map((layer) => {
          const sourceId = getWfsSourceId(layer)
          const geojson = wfsLayerData.get(sourceId)
          if (!geojson) return null

          const styleConfig = layer.style || {}

          // Build circle-radius expression
          let circleRadius: number | maplibregl.ExpressionSpecification = styleConfig.circleRadius || 6
          if (styleConfig.circleRadiusProperty) {
            const { field, stops } = styleConfig.circleRadiusProperty
            const [minVal, minRadius, maxVal, maxRadius] = stops
            // Default cap at 35px to prevent overlap, override with maxCircleRadius if specified
            const maxCap = styleConfig.maxCircleRadius ?? 35
            const cappedMax = Math.min(maxRadius, maxCap)
            circleRadius = [
              'min', cappedMax,
              ['max', minRadius,
                ['interpolate', ['linear'],
                  ['coalesce', ['get', field], minVal],
                  minVal, minRadius,
                  maxVal, cappedMax
                ]
              ]
            ]
          }

          // Build circle-color expression
          let circleColor: string | maplibregl.ExpressionSpecification = styleConfig.circleColor || '#088'
          if (styleConfig.circleColorProperty) {
            const { field, stops, defaultColor } = styleConfig.circleColorProperty
            circleColor = ['step',
              ['coalesce', ['get', field], -Infinity],
              defaultColor,
              ...stops.flat()
            ]
          }

          return (
            <Source key={sourceId} id={sourceId} type="geojson" data={geojson}>
              <Layer
                id={`${sourceId}-circle`}
                type="circle"
                paint={{
                  'circle-radius': circleRadius,
                  'circle-color': circleColor,
                  'circle-stroke-color': styleConfig.circleStrokeColor || '#fff',
                  'circle-stroke-width': styleConfig.circleStrokeWidth || 1,
                  'circle-opacity': layer.opacity || 1,
                }}
                metadata={{
                  title: layer.title,
                  wfsLayer: true,
                  wfsTypeName: layer.typeName,
                  wfsSourceId: sourceId,
                }}
              />
            </Source>
          )
        })}

        {/* Highlight layers */}
        <HighlightLayers features={highlightFeatures} />

        {/* Spatial filter visualization */}
        <SpatialFilterLayer filter={spatialFilter} />

        {/* Click buffer visualization */}
        {clickBufferBounds && <ClickBufferLayer bounds={clickBufferBounds} />}

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
