/**
 * Generic Map Container - Shared component for all map pages
 * Uses react-map-gl DataMap with unified state management
 * Provides MapContext for SearchCombobox and LayerControls
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import type { Polygon } from 'geojson'
import DataMap, { HighlightFeature, DrawMode, SpatialFilter } from '@/components/maps/data-map'
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
import { MapContext } from '@/context/map-context'
import { useMapInstance } from '@/context/map-instance-context'
import { HomeControl, DualScaleControl } from '@/components/maps/controls'
import type { LegendItem } from '@/components/maps/controls'
import { useFeatureSelection } from '@/hooks/use-feature-selection'
import { usePopupData } from '@/hooks/use-popup-data'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import type { LayerProps, WMSLayerProps } from '@/lib/types/mapping-types'
import { createSVGSymbol } from '@/lib/legend/symbol-generator'
import type { Legend } from '@/lib/types/geoserver-types'

interface MapBounds {
  west: number
  south: number
  east: number
  north: number
  width: number
  height: number
}

const BIVARIATE_CELL_RE = /^bivariate_(\d+)_(\d+)$/

/** Extract short tick label: "High Cap / Low Cost" → "High" (first word of the nth part) */
function shortLabel(title: string, index: 0 | 1): string {
  const part = title.split(' / ')[index]?.trim() ?? ''
  return part.split(' ')[0] ?? ''
}

interface VisibleWmsLayer {
  title: string
  layerName: string
  url: string
  bivariateLegend?: { xLabel: string; yLabel: string }
}

// Helper to fetch legend data for visible WMS layers (filtered by map extent)
async function fetchLegendDataForVisibleLayers(
  layers: LayerProps[],
  bounds?: MapBounds
): Promise<LegendItem[]> {
  const results: LegendItem[] = []

  // Extract visible WMS layers
  const getVisibleWmsLayers = (layerArray: LayerProps[]): VisibleWmsLayer[] => {
    const visible: VisibleWmsLayer[] = []
    for (const layer of layerArray) {
      if (layer.type === 'group' && 'layers' in layer) {
        visible.push(...getVisibleWmsLayers(layer.layers || []))
      } else if (layer.type === 'wms' && layer.visible) {
        const wmsLayer = layer as WMSLayerProps
        const sublayer = wmsLayer.sublayers?.[0]
        if (sublayer?.name) {
          visible.push({
            title: layer.title || sublayer.name,
            layerName: sublayer.name,
            url: wmsLayer.url || `${PROD_GEOSERVER_URL}/wms`,
            bivariateLegend: layer.bivariateLegend,
          })
        }
      }
    }
    return visible
  }

  const visibleLayers = getVisibleWmsLayers(layers)

  // Fetch legend for each visible layer
  for (const layer of visibleLayers) {
    try {
      // Build legend URL with optional BBOX filtering
      const params = new URLSearchParams({
        service: 'WMS',
        request: 'GetLegendGraphic',
        format: 'application/json',
        layer: layer.layerName,
        version: '1.3.0'
      })

      // Add extent parameters for content-dependent legend (GeoServer feature)
      // Requires hideEmptyRules to actually filter out symbols with no features in view
      // Skip for bivariate layers — we need the full grid regardless of viewport
      if (bounds && !layer.bivariateLegend) {
        params.set('BBOX', `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`)
        params.set('CRS', 'EPSG:4326')
        params.set('WIDTH', String(Math.round(bounds.width)))
        params.set('HEIGHT', String(Math.round(bounds.height)))
        params.set('SRS', 'EPSG:4326')
        params.set('SRCWIDTH', String(Math.round(bounds.width)))
        params.set('SRCHEIGHT', String(Math.round(bounds.height)))
        // GeoServer vendor option to hide legend rules with no matching features
        params.set('LEGEND_OPTIONS', 'hideEmptyRules:true;countMatched:true')
      }

      const legendUrl = `${layer.url}?${params.toString()}`
      const response = await fetch(legendUrl)
      if (!response.ok) continue

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) continue

      const legendData: Legend = await response.json()
      const rules = legendData?.Legend?.[0]?.rules || []

      if (rules.length === 0) continue

      // Bivariate legend: parse grid from bivariate_R_C rule names
      if (layer.bivariateLegend) {
        const cells: { row: number; col: number; color: string; title: string }[] = []
        let noData: { color: string; opacity: number; label: string } | undefined
        for (const rule of rules) {
          const poly = rule.symbolizers?.[0]?.Polygon
          if (!poly) continue
          if (rule.name === 'bivariate_nodata') {
            noData = {
              color: poly.fill ?? '#fff',
              opacity: parseFloat(poly['fill-opacity'] ?? '1'),
              label: rule.title || 'No Data',
            }
            continue
          }
          const m = rule.name?.match(BIVARIATE_CELL_RE)
          if (m) {
            cells.push({ row: +m[1], col: +m[2], color: poly.fill ?? '#000', title: rule.title || '' })
          }
        }
        if (cells.length > 0) {
          const maxRow = Math.max(...cells.map(c => c.row))
          const maxCol = Math.max(...cells.map(c => c.col))
          const colors: string[][] = Array.from({ length: maxRow + 1 }, () =>
            Array.from({ length: maxCol + 1 }, () => '#000')
          )
          const yTicks: string[] = Array.from({ length: maxRow + 1 }, () => '')
          const xTicks: string[] = Array.from({ length: maxCol + 1 }, () => '')
          for (const c of cells) {
            colors[c.row][c.col] = c.color
            if (!yTicks[c.row]) yTicks[c.row] = shortLabel(c.title, 0)
            if (!xTicks[c.col]) xTicks[c.col] = shortLabel(c.title, 1)
          }
          results.push({
            layerTitle: layer.title,
            symbols: [],
            bivariate: {
              colors,
              xLabel: layer.bivariateLegend.xLabel,
              yLabel: layer.bivariateLegend.yLabel,
              xTicks,
              yTicks,
              noData: noData ?? undefined,
            }
          })
        }
        continue
      }

      const symbols: LegendItem['symbols'] = []
      for (const rule of rules) {
        const label = rule.title || rule.name
        const result = createSVGSymbol(rule.symbolizers)
        // Handle both SVGSVGElement and CompositeSymbolResult
        let svgHtml = ''
        if ('outerHTML' in result) {
          svgHtml = result.outerHTML
        } else if (result.symbol) {
          svgHtml = result.symbol.outerHTML
        } else if (result.html && 'outerHTML' in result.html) {
          svgHtml = result.html.outerHTML
        }
        if (svgHtml) {
          symbols.push({ label, svgHtml })
        }
      }

      if (symbols.length > 0) {
        results.push({
          layerTitle: layer.title,
          symbols
        })
      }
    } catch (e) {
      console.warn(`Failed to fetch legend for ${layer.layerName}:`, e)
    }
  }

  return results
}

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
  onExternalDrawComplete?: (polygon: Polygon) => void
  /** Register callback to clear spatial filter (called by startDraw) */
  onRegisterClearSpatialFilter?: (callback: () => void) => void
  /** Register callback for when layer is turned off (clears selection/highlights) */
  onRegisterLayerTurnedOff?: (callback: (layerTitle: string) => void) => void
  /** Called when all selections are cleared (context menu, popup close, etc.) */
  onClearSearch?: () => void
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
  onRegisterLayerTurnedOff,
  onClearSearch,
}: GenericMapContainerProps) {
  const isMobile = useIsMobile()
  const { viewMode, setViewMode, center, zoom, setMapPosition, basemap, clickBufferBounds, setClickBufferBounds, featureBbox, setFeatureBbox, selectedFeatureRefs, setSelectedFeatureRefs, popupCoords, setPopupCoords } = useMapUrlSync()
  const { setNavOpened } = useSidebar()
  const rawLayersConfig = useGetLayerConfigsData(layerConfigKey)
  const { selectedLayerTitles, isInitialized, groupVisibility, layerOpacity } = useLayerUrl()
  const layersConfig = useLayerVisibility(rawLayersConfig || [], selectedLayerTitles, isInitialized, groupVisibility, layerOpacity)
  const popupSheetRef = useRef<PopupSheetRef>(null)
  const sheetTriggerRef = useRef<HTMLButtonElement>(null)

  // Ref to hold current layers config for export control legend callback
  const layersConfigRef = useRef<LayerProps[]>(layersConfig)
  layersConfigRef.current = layersConfig

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

  // Register layer turned off callback with parent context (safe - callback is stable)
  if (onRegisterLayerTurnedOff) {
    onRegisterLayerTurnedOff(handleLayerTurnedOff)
  }

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

    // Lazy load export control
    import('@/components/maps/controls/export-control').then(({ ExportControl }) => {
      const exportControl = new ExportControl({
        pageSize: 'A4',
        pageOrientation: 'landscape',
        format: 'png',
        dpi: 300,
        filename: 'ugs-map',
        getLegendData: (bounds) => fetchLegendDataForVisibleLayers(layersConfigRef.current, bounds)
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
    }
  }, [mapInstance, isMobile])

  // UI panel state
  const [panelState, setPanelState] = useState({
    tablePanelSize: 50,
    isSheetOpen: false,
    sheetWidth: 480,
  })

  // Additive mode: toggled via button OR held via Shift key (only when no other mode active)
  const [additiveModeToggled, setAdditiveModeToggled] = useState(false)
  const [isShiftHeld, setIsShiftHeld] = useState(false)

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

  // Additive mode only active when no other mode is active (shift-click disabled in draw/box modes)
  const noOtherModeActive = effectiveDrawMode === 'off' && !mapInteraction.boxSelectMode
  const isAdditiveMode = noOtherModeActive && (additiveModeToggled || isShiftHeld)

  // Register clear callback so startDraw can clear existing drawings
  const clearSpatialFilter = useCallback(() => {
    setMapInteraction(prev => ({ ...prev, spatialFilter: null }))
  }, [])

  // Register once on mount (safe - callback is stable)
  if (onRegisterClearSpatialFilter) {
    onRegisterClearSpatialFilter(clearSpatialFilter)
  }

  // Centralized mode setter - handles mutual exclusivity between all selection modes
  const setActiveMode = useCallback((
    mode: 'draw' | 'boxSelect' | 'additive' | 'none',
    drawType?: 'rectangle' | 'polygon'
  ) => {
    // Update map interaction state
    setMapInteraction(prev => ({
      ...prev,
      internalDrawMode: mode === 'draw' ? drawType! : 'off',
      boxSelectMode: mode === 'boxSelect',
      boxSelectBounds: mode === 'boxSelect' ? prev.boxSelectBounds : null,
    }))

    // Update additive mode
    setAdditiveModeToggled(mode === 'additive')

    // Sync external draw mode if provided
    if (onExternalDrawModeChange) {
      onExternalDrawModeChange(mode === 'draw' ? drawType! : 'off')
    }
  }, [onExternalDrawModeChange])

  // Handler for draw mode toggle from toolbar
  const handleDrawModeChange = useCallback((mode: DrawMode) => {
    if (mode === 'off') {
      setActiveMode('none')
    } else {
      setActiveMode('draw', mode)
    }
  }, [setActiveMode])

  const handleSpatialFilterChange = useCallback((filter: SpatialFilter) => {
    setMapInteraction(prev => ({ ...prev, spatialFilter: filter }))
    // Clear previous selections when a new area is drawn
    if (filter) {
      setHighlightedFeatures([])
      clearAllSelections()
    }
  }, [clearAllSelections])

  // Handler for box select toggle from toolbar
  const handleBoxSelectModeChange = useCallback((active: boolean) => {
    setActiveMode(active ? 'boxSelect' : 'none')
  }, [setActiveMode])

  const handleBoxSelectConfirm = useCallback((bounds: { sw: [number, number]; ne: [number, number] }) => {
    // Store frozen bounds for visualization
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: bounds }))
  }, [])

  // Context-exposed draw controls (only used when skipContextProvider is false)
  const externalDrawCallbackRef = useRef<((polygon: Polygon) => void) | null>(null)

  const startDraw = useCallback((mode: 'rectangle' | 'polygon', onComplete: (polygon: Polygon) => void) => {
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
    setPopupCoords(null)
    onClearSearch?.()
    // Close the sheet and clear box select bounds
    setPanelState(prev => ({ ...prev, isSheetOpen: false }))
    setMapInteraction(prev => ({ ...prev, boxSelectBounds: null }))
  }, [clearAllSelections, setPopupCoords, onClearSearch])

  // Derived: click point for raster queries (center of click buffer)
  const clickPoint = useMemo(() => {
    if (!clickBufferBounds) return null
    return getBboxCenter(clickBufferBounds)
  }, [clickBufferBounds])

  // Unified popup data: groups features by layer + fetches raster values
  const { popupData: popupContent } = usePopupData({
    vectorFeatures: selectedFeatures,
    clickPoint,
    clickBbox: clickBufferBounds,
    layersConfig,
  })

  // Derived: has results (includes raster-only layers)
  const hasResults = useMemo(() => popupContent.length > 0, [popupContent])

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
            onFeatureClick={(...args) => { setPopupCoords(null); handleFeatureClick(...args) }}
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
            onExternalDrawComplete={onExternalDrawComplete}
            boxSelectMode={mapInteraction.boxSelectMode}
            onBoxSelectModeChange={handleBoxSelectModeChange}
            boxSelectBounds={mapInteraction.boxSelectBounds}
            onBoxSelectConfirm={handleBoxSelectConfirm}
            isAdditiveMode={isAdditiveMode}
            onAdditiveModeToggle={() => additiveModeToggled ? setActiveMode('none') : setActiveMode('additive')}
            onClearSelection={handleClearAllSelections}
            pinCoords={popupCoords}
            onPinChange={setPopupCoords}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            hasResults={hasResults}
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
              isOpen={panelState.isSheetOpen}
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
              isOpen={panelState.isSheetOpen}
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
