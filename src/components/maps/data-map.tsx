import { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import Map, { NavigationControl, Source, Layer, MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  DEFAULT_CLICK_TOLERANCE,
  BOX_SELECT_SIZE,
  BOX_SELECT_PAGE_SIZE,
  BOX_SELECT_MIN_ZOOM,
} from './constants'
import { BASEMAP_STYLES, DEFAULT_BASEMAP } from '@/lib/basemaps'
import { BoxSelectOverlay, MapToolsControl } from './controls'
import { HighlightLayers, SpatialFilterLayer, ClickBufferLayer } from './layers'
import { flattenWmsLayers, buildWmsTileUrl, getWmsLayerName } from '@/lib/map/layer-utils'
import { calculateBboxFromGeometry } from '@/lib/map/geometry-utils'
import { useTerraDraw } from '@/hooks/use-terra-draw'
import { useFeatureQuery } from '@/hooks/use-feature-query'
import type { DataMapProps } from './types'
import { LoadingOverlay } from '@/components/custom/loading-spinner'
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
  drawMode = 'off',
  onDrawModeChange,
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
}: DataMapProps) {
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track current zoom for box select validation
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [styleLoaded, setStyleLoaded] = useState(false)
  const hasRestoredRef = useRef(false)

  // Context menu state
  const [contextMenuCoords, setContextMenuCoords] = useState<ContextMenuCoords | null>(null)
  const [contextMenuOpen, setContextMenuOpen] = useState(false)

  // Check if zoomed in enough for box select
  const isBoxSelectZoomValid = currentZoom >= BOX_SELECT_MIN_ZOOM

  // Get the raw map instance (memoized to avoid recreating on every render)
  const mapInstance = mapRef.current?.getMap() ?? null

  // Get visible WMS layers - flatten groups recursively (defined early for use in callbacks)
  const visibleWmsLayers = useMemo(() => flattenWmsLayers(layers), [layers])

  // Ref for stable access to visibleWmsLayers in callbacks (prevents TerraDraw reinit)
  const visibleWmsLayersRef = useRef(visibleWmsLayers)
  visibleWmsLayersRef.current = visibleWmsLayers

  // Feature query mutations
  const { clickQuery, boxSelectQuery, polygonQuery, isLoading: queryLoading } = useFeatureQuery({
    onPolygonQuerySuccess: (features) => {
      if (onFeatureClick && features.length > 0) {
        onFeatureClick(features, { additive: false })
      }
    },
  })

  // Ref for stable access to polygonQuery mutation (prevents callback reference changes)
  const polygonQueryRef = useRef(polygonQuery)
  polygonQueryRef.current = polygonQuery

  // Wrap onSpatialFilterChange to also trigger polygon query
  // Uses refs for visibleWmsLayers and polygonQuery to keep callback stable (prevents TerraDraw reinit)
  const handleSpatialFilterChange = useCallback((filter: NonNullable<typeof spatialFilter> | null) => {
    onSpatialFilterChange?.(filter)

    // Trigger polygon query if filter has a polygon
    const layers = visibleWmsLayersRef.current
    if (filter?.polygon && layers.length > 0) {
      polygonQueryRef.current.mutate({
        polygon: filter.polygon,
        visibleLayers: layers,
        wmsUrl,
      })
    }
  }, [onSpatialFilterChange, wmsUrl])

  // Terra Draw hook
  const { justFinishedDrawingRef } = useTerraDraw({
    map: mapInstance,
    styleLoaded,
    drawMode,
    onDrawModeChange,
    onSpatialFilterChange: handleSpatialFilterChange,
  })

  // Calculate initial view - use feature_bbox if restoring, otherwise use props
  const initialViewRef = useRef<{
    longitude?: number
    latitude?: number
    zoom?: number
    bounds?: [[number, number], [number, number]]
    fitBoundsOptions?: { padding: number }
  } | null>(null)
  if (!initialViewRef.current) {
    const bbox = featureBbox || clickBufferBounds
    if (bbox) {
      initialViewRef.current = {
        bounds: [bbox.sw, bbox.ne],
        fitBoundsOptions: { padding: 50 }
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
    if (boxSelectMode || drawMode !== 'off') return
    if (justFinishedDrawingRef.current) {
      justFinishedDrawingRef.current = false
      return
    }
    if (!onFeatureClick || visibleWmsLayers.length === 0) return

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

    clickQuery.mutate(
      {
        point: { x: e.point.x, y: e.point.y },
        visibleLayers: visibleWmsLayers,
        tolerance: clickTolerance,
        mapInstance: map,
        wmsUrl,
      },
      {
        onSuccess: (features) => {
          if (features.length > 0) {
            onFeatureClick(features, { additive: isAdditive })

            const firstFeature = features.find(f => f.geometry)
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
  }, [onFeatureClick, visibleWmsLayers, clickTolerance, isAdditiveMode, clickQuery, boxSelectMode, drawMode, onClickBufferChange, onFeatureBboxChange, justFinishedDrawingRef, wmsUrl, spatialFilter, onSpatialFilterChange])

  // Handle map move end - track zoom only (box select now uses click-to-confirm)
  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const mapCenter = map.getCenter()
    const mapZoom = map.getZoom()

    setCurrentZoom(mapZoom)
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

    // Trigger the query with the frozen bbox
    if (visibleWmsLayers.length > 0 && onFeatureClick) {
      boxSelectQuery.mutate(
        {
          visibleLayers: visibleWmsLayers,
          mapInstance: map,
          containerRect,
          boxSize: BOX_SELECT_SIZE,
          pageSize: BOX_SELECT_PAGE_SIZE,
          wmsUrl,
        },
        {
          onSuccess: (features) => {
            if (features.length > 0) {
              // Use current isAdditiveMode value (not stale closure)
              onFeatureClick(features, { additive: isAdditiveMode })
            }
          },
        }
      )
    }
  }, [onBoxSelectConfirm, visibleWmsLayers, boxSelectQuery, wmsUrl, onFeatureClick, isAdditiveMode])

  // Handle map load
  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      setStyleLoaded(true)
      onMapReady?.(map)

      // Restore query from URL if clickBufferBounds exists
      if (!hasRestoredRef.current && clickBufferBounds && onFeatureClick && visibleWmsLayers.length > 0) {
        hasRestoredRef.current = true

        const centerLng = (clickBufferBounds.sw[0] + clickBufferBounds.ne[0]) / 2
        const centerLat = (clickBufferBounds.sw[1] + clickBufferBounds.ne[1]) / 2
        const centerPoint = map.project([centerLng, centerLat])

        const swPoint = map.project([clickBufferBounds.sw[0], clickBufferBounds.sw[1]])
        const nePoint = map.project([clickBufferBounds.ne[0], clickBufferBounds.ne[1]])
        const tolerance = Math.abs(nePoint.x - swPoint.x) / 2

        clickQuery.mutate(
          {
            point: { x: centerPoint.x, y: centerPoint.y },
            visibleLayers: visibleWmsLayers,
            tolerance: tolerance || clickTolerance,
            mapInstance: map,
            wmsUrl,
          },
          {
            onSuccess: (features) => {
              if (features.length > 0) {
                onFeatureClick(features, { additive: false })
              }
            },
          }
        )
      }
    }
  }, [onMapReady, clickBufferBounds, onFeatureClick, visibleWmsLayers, clickTolerance, clickQuery, wmsUrl])

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
    if (!map || !onFeatureClick || visibleWmsLayers.length === 0) return

    const point = map.project([coords.lng, coords.lat])

    // Calculate click buffer bbox for visualization
    const sw = map.unproject([point.x - clickTolerance, point.y + clickTolerance])
    const ne = map.unproject([point.x + clickTolerance, point.y - clickTolerance])
    onClickBufferChange?.({ sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat] })

    clickQuery.mutate(
      {
        point: { x: point.x, y: point.y },
        visibleLayers: visibleWmsLayers,
        tolerance: clickTolerance,
        mapInstance: map,
        wmsUrl,
      },
      {
        onSuccess: (features) => {
          if (features.length > 0) {
            onFeatureClick(features, { additive: false })
          }
        },
      }
    )
  }, [visibleWmsLayers, clickTolerance, clickQuery, wmsUrl, onFeatureClick, onClickBufferChange])

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
        onClearSelection={highlightFeatures.length > 0 ? onClearSelection : undefined}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterHere={handleCenterHere}
        hasSelection={highlightFeatures.length > 0}
        currentZoom={currentZoom}
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
        cursor={boxSelectMode ? 'move' : onFeatureClick ? (isAdditiveMode ? 'copy' : 'pointer') : 'grab'}
        boxZoom={false}
        onLoad={handleLoad}
      >
        <NavigationControl position="top-left" />

        {/* Map tools control */}
        <MapToolsControl
          drawMode={drawMode}
          onDrawModeChange={onDrawModeChange}
          hasFilter={!!spatialFilter}
          onClearFilter={onSpatialFilterChange ? () => onSpatialFilterChange(null) : undefined}
          boxSelectActive={boxSelectMode}
          onBoxSelectToggle={onBoxSelectModeChange}
          isAdditiveMode={isAdditiveMode}
          onAdditiveModeToggle={onAdditiveModeToggle}
          position="top-right"
        />

        {/* WMS Layers */}
        {visibleWmsLayers.map((layer) => {
          const layerName = getWmsLayerName(layer)
          const cqlFilter = layerFilters[layer.title]
          const tileUrl = buildWmsTileUrl(wmsUrl, layerName, cqlFilter)

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
                  'wms-url': wmsUrl,
                  'wms-layer': layerName,
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
