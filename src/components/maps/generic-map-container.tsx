/**
 * Generic Map Container - Shared component for all map pages
 * Uses react-map-gl DataMap with unified state management
 * Provides MapContext for SearchCombobox and LayerControls
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import DataMap, { ClickedFeature, HighlightFeature, DrawMode, SpatialFilter } from '@/components/maps/data-map'
import { PopupSheet, PopupSheetRef } from '@/components/maps/popups/popup-sheet'
import { QueryResultsTable } from '@/components/data-table/query-results-table'
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs'
import { useLayerUrl } from '@/context/layer-url-provider'
import { useLayerVisibility } from '@/hooks/use-layer-visibility'
import { useMapUrlSync, type ViewMode } from '@/hooks/use-map-url-sync'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'
import { MobileMapNav } from './mobile-map-nav'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import type { LayerContentProps } from '@/components/maps/popups/popup-content-with-pagination'
import { MapContext } from '@/context/map-context'
import { useMapInstance } from '@/context/map-instance-context'
import { ViewModeControl } from '@/lib/map/controls/view-mode-control'
import { HomeControl } from '@/lib/map/controls/home-control'
import { DualScaleControl } from '@/lib/map/controls/dual-scale-control'
import { useFeatureSelection } from '@/hooks/use-feature-selection'
import { findWmsLayerByTitle } from '@/lib/map/layer-utils'

interface GenericMapContainerProps {
  /** Title shown in the popup drawer header */
  popupTitle: string
  /** Optional CQL filters for WMS layers, keyed by layer title */
  layerFilters?: Record<string, string>
  /** Layer config key (default: 'layers') */
  layerConfigKey?: string
  /** Callback when map is ready - used for lifting map instance to page level */
  onMapReady?: (map: maplibregl.Map) => void
  /** If true, don't wrap with MapContext.Provider (parent provides it) */
  skipContextProvider?: boolean
  /** External draw mode (used when skipContextProvider is true) */
  externalDrawMode?: DrawMode
  /** Callback when external draw mode changes */
  onExternalDrawModeChange?: (mode: DrawMode) => void
  /** Callback when external drawing completes with polygon */
  onExternalDrawComplete?: (polygon: import('geojson').Polygon) => void
  /** Register callback to clear spatial filter (called by startDraw) */
  onRegisterClearSpatialFilter?: (callback: () => void) => void
}

export default function GenericMapContainer({
  popupTitle,
  layerFilters = {},
  layerConfigKey = 'layers',
  onMapReady: onMapReadyProp,
  skipContextProvider = false,
  externalDrawMode,
  onExternalDrawModeChange,
  onExternalDrawComplete,
  onRegisterClearSpatialFilter,
}: GenericMapContainerProps) {
  const isMobile = useIsMobile()
  const { viewMode, setViewMode, center, zoom, setMapPosition, basemap, clickBufferBounds, setClickBufferBounds, featureBbox, setFeatureBbox, selectedFeatureRefs, setSelectedFeatureRefs } = useMapUrlSync()
  const { setNavOpened } = useSidebar()
  const rawLayersConfig = useGetLayerConfigsData(layerConfigKey)
  const { selectedLayerTitles, isInitialized } = useLayerUrl()
  const layersConfig = useLayerVisibility(rawLayersConfig || [], selectedLayerTitles, isInitialized)
  const popupSheetRef = useRef<PopupSheetRef>(null)
  const sheetTriggerRef = useRef<HTMLButtonElement>(null)

  // Map instance state for MapContext
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | undefined>(undefined)
  const [isSketching, setIsSketching] = useState(false)
  const { setMap: setMapInstanceGlobal } = useMapInstance()

  // Highlighted features state - controlled by popup/table navigation
  // This is the single source of truth for what's highlighted on the map
  const [highlightedFeatures, setHighlightedFeatures] = useState<HighlightFeature[]>([])

  // Handle map ready callback
  const handleMapReady = useCallback((map: maplibregl.Map) => {
    setMapInstance(map)
    setMapInstanceGlobal(map) // Set in global context for footer coordinates
    onMapReadyProp?.(map)
  }, [onMapReadyProp, setMapInstanceGlobal])

  // Callback for popup/table to update which features are highlighted
  const handleHighlightChange = useCallback((features: HighlightFeature[]) => {
    setHighlightedFeatures(features)
  }, [])

  // Feature selection hook
  const {
    selectedFeatures,
    handleFeatureClick,
    handleLayerTurnedOff,
    clearAllSelections,
    shouldIgnoreNextClick,
    setIgnoreNextClick,
    consumeIgnoreClick,
  } = useFeatureSelection({
    viewMode,
    selectedFeatureRefs,
    setSelectedFeatureRefs,
    setClickBufferBounds,
    setFeatureBbox,
    popupSheetRef,
    onHighlightChange: handleHighlightChange,
  })

  // Ref for ViewModeControl to sync state
  const viewModeControlRef = useRef<ViewModeControl | null>(null)
  // Stable ref for setViewMode to avoid recreating controls
  const setViewModeRef = useRef(setViewMode)
  setViewModeRef.current = setViewMode

  // Add map controls when map is ready (desktop only)
  useEffect(() => {
    if (!mapInstance || isMobile) return

    const controls: maplibregl.IControl[] = []

    // Home control (reset to default bounds)
    const homeControl = new HomeControl()
    mapInstance.addControl(homeControl, 'top-left')
    controls.push(homeControl)

    // Geolocate control
    const geolocateControl = new maplibregl.GeolocateControl({
      showUserLocation: false,
      showAccuracyCircle: false,
      fitBoundsOptions: { maxZoom: 18 }
    })
    mapInstance.addControl(geolocateControl, 'top-left')
    controls.push(geolocateControl)

    // Dual scale control (bottom-left)
    const scaleControl = new DualScaleControl({ maxWidth: 150 })
    mapInstance.addControl(scaleControl, 'bottom-left')
    controls.push(scaleControl)

    // View mode control - uses ref callback to avoid recreation on mode change
    const viewModeControl = new ViewModeControl({
      onModeChange: (mode) => setViewModeRef.current(mode),
    })
    mapInstance.addControl(viewModeControl, 'top-right')
    controls.push(viewModeControl)
    viewModeControlRef.current = viewModeControl

    // Lazy load export control
    import('@watergis/maplibre-gl-export').then(({ MaplibreExportControl, Size, Format, DPI }) => {
      import('@watergis/maplibre-gl-export/dist/maplibre-gl-export.css')
      const exportControl = new MaplibreExportControl({
        PageSize: Size.A4,
        PageOrientation: 'landscape',
        Format: Format.PNG,
        DPI: DPI[300],
        Crosshair: true,
        PrintableArea: true,
        Local: 'en',
        Filename: 'ugs-map'
      })
      mapInstance.addControl(exportControl, 'top-left')
      controls.push(exportControl)
    }).catch(console.warn)

    return () => {
      controls.forEach(control => {
        try {
          mapInstance.removeControl(control)
        } catch { /* control may already be removed */ }
      })
      viewModeControlRef.current = null
    }
  }, [mapInstance, isMobile])

  // UI panel state
  const [panelState, setPanelState] = useState({
    tablePanelSize: 50,
    isSheetOpen: false,
    sheetWidth: 480,
  })

  // Additive mode: toggled via button OR held via Shift key
  const [additiveModeToggled, setAdditiveModeToggled] = useState(false)
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const isAdditiveMode = additiveModeToggled || isShiftHeld

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Map interaction state (internal, used when skipContextProvider is false)
  const [mapInteraction, setMapInteraction] = useState({
    internalDrawMode: 'off' as DrawMode,
    spatialFilter: null as SpatialFilter,
    boxSelectMode: false,
    boxSelectBounds: null as { sw: [number, number]; ne: [number, number] } | null,
  })

  // Use external draw mode if provided, otherwise use internal
  const effectiveDrawMode = externalDrawMode ?? mapInteraction.internalDrawMode

  // Register clear callback so startDraw can clear existing drawings
  const clearSpatialFilter = useCallback(() => {
    setMapInteraction(prev => ({ ...prev, spatialFilter: null }))
  }, [])

  // Register once on mount (safe - callback is stable)
  if (onRegisterClearSpatialFilter) {
    onRegisterClearSpatialFilter(clearSpatialFilter)
  }

  // Memoized callbacks for map interactions (prevents useTerraDraw from reinitializing)
  const handleDrawModeChange = useCallback((mode: DrawMode) => {
    if (onExternalDrawModeChange) {
      onExternalDrawModeChange(mode)
    } else {
      setMapInteraction(prev => ({ ...prev, internalDrawMode: mode }))
    }
  }, [onExternalDrawModeChange])

  const handleSpatialFilterChange = useCallback((filter: SpatialFilter) => {
    setMapInteraction(prev => ({ ...prev, spatialFilter: filter }))
    // If there's an external callback waiting for the polygon, call it
    if (filter?.polygon && onExternalDrawComplete) {
      onExternalDrawComplete(filter.polygon)
    }
  }, [onExternalDrawComplete])

  const handleBoxSelectModeChange = useCallback((active: boolean) => {
    // Clear frozen bounds when toggling box select mode
    setMapInteraction(prev => ({
      ...prev,
      boxSelectMode: active,
      boxSelectBounds: active ? prev.boxSelectBounds : null,
    }))
  }, [])

  const handleBoxSelectConfirm = useCallback((bounds: { sw: [number, number]; ne: [number, number] }) => {
    // Store frozen bounds for visualization
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: bounds }))
  }, [])

  // Context-exposed draw controls (only used when skipContextProvider is false)
  const externalDrawCallbackRef = useRef<((polygon: import('geojson').Polygon) => void) | null>(null)

  const startDraw = useCallback((mode: 'rectangle' | 'polygon', onComplete: (polygon: import('geojson').Polygon) => void) => {
    externalDrawCallbackRef.current = onComplete
    setMapInteraction(prev => ({ ...prev, internalDrawMode: mode, spatialFilter: null }))
  }, [])

  const cancelDraw = useCallback(() => {
    externalDrawCallbackRef.current = null
    setMapInteraction(prev => ({ ...prev, internalDrawMode: 'off', spatialFilter: null }))
  }, [])

  // MapContext value
  const mapContextValue = useMemo(() => ({
    map: mapInstance,
    isSketching,
    setIsSketching,
    getIsSketching: () => isSketching,
    shouldIgnoreNextClick,
    setIgnoreNextClick,
    consumeIgnoreClick,
    onLayerTurnedOff: handleLayerTurnedOff,
    drawMode: effectiveDrawMode,
    startDraw,
    cancelDraw,
  }), [mapInstance, isSketching, shouldIgnoreNextClick, setIgnoreNextClick, consumeIgnoreClick, handleLayerTurnedOff, effectiveDrawMode, startDraw, cancelDraw])

  // Clear highlights when selections are cleared
  const handleClearAllSelections = useCallback(() => {
    setHighlightedFeatures([])
    clearAllSelections()
    // Close the sheet and clear box select bounds
    setPanelState(prev => ({ ...prev, isSheetOpen: false }))
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: null }))
  }, [clearAllSelections])

  // Derived: has results
  const hasResults = useMemo(() => selectedFeatures.length > 0, [selectedFeatures])

  // Sync ViewModeControl state (mode and hasResults)
  useEffect(() => {
    viewModeControlRef.current?.setHasResults(hasResults)
    viewModeControlRef.current?.setMode(viewMode)
  }, [hasResults, viewMode])

  // Derived: popup content grouped by layer (includes popupFields from layer config)
  const popupContent: LayerContentProps[] = useMemo(() => {
    if (selectedFeatures.length === 0) return []

    const byLayer = new Map<string, ClickedFeature[]>()
    for (const f of selectedFeatures) {
      const title = f.layerTitle || 'Unknown Layer'
      if (!byLayer.has(title)) byLayer.set(title, [])
      byLayer.get(title)!.push(f)
    }

    return Array.from(byLayer.entries()).map(([title, features]) => {
      // Look up layer config to get popupFields and CRS
      const wmsLayer = findWmsLayerByTitle(layersConfig, title)
      const sublayerConfig = wmsLayer?.sublayers?.[0]

      return {
        groupLayerTitle: title,
        layerTitle: title,
        // WFS queries always return EPSG:4326 (srsName=EPSG:4326 in use-feature-info-query.tsx)
        sourceCRS: 'EPSG:4326',
        visible: true,
        popupFields: sublayerConfig?.popupFields,
        relatedTables: sublayerConfig?.relatedTables,
        linkFields: sublayerConfig?.linkFields,
        colorCodingMap: sublayerConfig?.colorCodingMap,
        features: features.map((f) => ({
          type: 'Feature' as const,
          id: f.id,
          geometry: f.geometry || { type: 'Point' as const, coordinates: [0, 0] },
          properties: f.properties,
          namespace: title,
        })),
      }
    })
  }, [selectedFeatures, layersConfig])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'map' && hasResults) {
      requestAnimationFrame(() => popupSheetRef.current?.open())
    }
  }, [setViewMode, hasResults])

  const handleCloseTable = useCallback(() => {
    handleClearAllSelections()
    setViewMode('map')
    // Clear frozen box select bounds so user can make a new selection
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: null }))
  }, [handleClearAllSelections, setViewMode])

  const handleSheetClose = useCallback(() => {
    handleClearAllSelections()
    // Clear frozen box select bounds so user can make a new selection
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: null }))
  }, [handleClearAllSelections])

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setPanelState(prev => ({ ...prev, isSheetOpen: open }))
  }, [])

  const shouldShrinkMap = viewMode === 'map' && panelState.isSheetOpen && !isMobile

  const content = (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Map + Drawer row */}
      <div
        className="relative flex min-h-0 overflow-hidden"
        style={{
          flex: viewMode === 'table' ? '0 0 0%'
            : viewMode === 'split' ? `1 1 ${100 - panelState.tablePanelSize}%`
            : '1 1 100%'
        }}
      >
        {/* Map section */}
        <div
          className="relative h-full overflow-hidden transition-[width] duration-200 ease-linear"
          style={{ width: shouldShrinkMap ? `calc(100% - ${panelState.sheetWidth}px)` : '100%' }}
        >
          <DataMap
            wmsUrl={`${PROD_GEOSERVER_URL}/wms`}
            layers={layersConfig}
            center={center}
            zoom={zoom}
            highlightFeatures={highlightedFeatures}
            onFeatureClick={handleFeatureClick}
            onMoveEnd={setMapPosition}
            layerFilters={layerFilters}
            onMapReady={handleMapReady}
            basemapId={basemap}
            clickBufferBounds={clickBufferBounds}
            onClickBufferChange={setClickBufferBounds}
            featureBbox={featureBbox}
            onFeatureBboxChange={setFeatureBbox}
            drawMode={effectiveDrawMode}
            onDrawModeChange={handleDrawModeChange}
            spatialFilter={mapInteraction.spatialFilter}
            onSpatialFilterChange={handleSpatialFilterChange}
            boxSelectMode={mapInteraction.boxSelectMode}
            onBoxSelectModeChange={handleBoxSelectModeChange}
            boxSelectBounds={mapInteraction.boxSelectBounds}
            onBoxSelectConfirm={handleBoxSelectConfirm}
            isAdditiveMode={isAdditiveMode}
            onAdditiveModeToggle={() => setAdditiveModeToggled(prev => !prev)}
            onClearSelection={handleClearAllSelections}
          />
        </div>

        {/* Popup sheet - desktop */}
        {viewMode === 'map' && !isMobile && (
          <div
            className="h-full border-l bg-background overflow-hidden transition-[width] duration-200 ease-linear"
            style={{ width: panelState.isSheetOpen ? `${panelState.sheetWidth}px` : 0 }}
          >
            <PopupSheet
              ref={popupSheetRef}
              sheetTriggerRef={sheetTriggerRef}
              popupContent={popupContent}
              popupTitle={popupTitle}
              onClose={handleSheetClose}
              onOpenChange={handleSheetOpenChange}
              onHighlightChange={handleHighlightChange}
              width={panelState.sheetWidth}
              onWidthChange={(width) => setPanelState(prev => ({ ...prev, sheetWidth: width }))}
            />
          </div>
        )}

        {/* Mobile sheet */}
        {viewMode === 'map' && isMobile && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-xl shadow-lg",
              "transition-transform duration-200 ease-linear",
              panelState.isSheetOpen ? "translate-y-0" : "translate-y-full"
            )}
            style={{ height: '70%' }}
          >
            <PopupSheet
              ref={popupSheetRef}
              sheetTriggerRef={sheetTriggerRef}
              popupContent={popupContent}
              popupTitle={popupTitle}
              onClose={handleSheetClose}
              onOpenChange={handleSheetOpenChange}
              onHighlightChange={handleHighlightChange}
            />
          </div>
        )}
      </div>

      {/* Resize handle - only in split mode */}
      {viewMode === 'split' && (
        <div
          className="h-3 bg-border hover:bg-accent active:bg-accent cursor-row-resize flex items-center justify-center shrink-0 touch-none"
          onMouseDown={(e) => {
            e.preventDefault()
            const startY = e.clientY
            const startSize = panelState.tablePanelSize
            const container = e.currentTarget.parentElement
            if (!container) return
            const containerHeight = container.clientHeight

            const onMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = startY - moveEvent.clientY
              const deltaPercent = (deltaY / containerHeight) * 100
              setPanelState(prev => ({ ...prev, tablePanelSize: Math.min(80, Math.max(20, startSize + deltaPercent)) }))
            }

            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('mouseup', onMouseUp)
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
          }}
        >
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
      )}

      {/* Table section */}
      <div
        className="bg-background border-t overflow-hidden"
        style={{
          flex: viewMode === 'map' ? '0 0 0%'
            : viewMode === 'split' ? `1 1 ${panelState.tablePanelSize}%`
            : '1 1 100%'
        }}
      >
        {(viewMode === 'split' || viewMode === 'table') && (
          <QueryResultsTable
            layerContent={popupContent}
            onClose={handleCloseTable}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            selectedFeatureRefs={selectedFeatureRefs}
            onSelectedFeaturesChange={setSelectedFeatureRefs}
            onHighlightChange={handleHighlightChange}
          />
        )}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <MobileMapNav
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onOpenLayers={() => setNavOpened(true)}
        />
      )}
    </div>
  )

  // Optionally skip context provider if parent provides it
  if (skipContextProvider) {
    return content
  }

  return (
    <MapContext.Provider value={mapContextValue}>
      {content}
    </MapContext.Provider>
  )
}
