/**
 * Generic Map Container - Shared component for all map pages
 * Uses react-map-gl DataMap with unified state management
 * Reads draw lifecycle and registrations from MapContext (owned by useMapContextState)
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import DataMap, { HighlightFeature, DrawMode, SpatialFilter } from '@/components/maps/data-map'
import { PopupSheet, PopupSheetRef } from '@/components/maps/popups/popup-sheet'
import { QueryResultsTable } from '@/components/data-table/query-results-table'
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs'
import { useLayerUrl } from '@/context/layer-url-provider'
import { flattenDataLayersWithAncestors, resolveLeafVisibility } from '@/lib/map/layer-utils'
import { useMapUrlSync, type ViewMode } from '@/hooks/use-map-url-sync'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'
import { MobileMapNav } from './mobile-map-nav'
import { PROD_GEOSERVER_URL, POPUP_TITLES } from '@/lib/constants'
import { useMap } from '@/hooks/use-map'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { HomeControl, DualScaleControl } from '@/components/maps/controls'
import type { LegendItem } from '@/components/maps/controls'
import { useFeatureSelection } from '@/hooks/use-feature-selection'
import { usePopupData } from '@/hooks/use-popup-data'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import type { LayerProps, WMSLayerProps, COGLayerProps } from '@/lib/types/mapping-types'
import { createSVGSymbol } from '@/lib/legend/symbol-generator'
import { createRasterSymbol } from '@/lib/legend/symbolizers/raster'
import { loadCogMetadata, deriveRange } from '@/hooks/use-cog-metadata'
import type { Symbolizer } from '@/lib/types/geoserver-types'
import { fetchLegendRulesBySublayer } from '@/lib/legend/wms-legend-service'

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

// Helper to fetch legend data for currently-displayed WMS layers (filtered by map extent).
// "Displayed" = leaf checkbox on AND parent group toggle on, computed from URL state.
async function fetchLegendDataForVisibleLayers(
  layers: LayerProps[],
  displayedTitles: Set<string>,
  bounds?: MapBounds
): Promise<LegendItem[]> {
  const results: LegendItem[] = []

  const getVisibleWmsLayers = (layerArray: LayerProps[]): VisibleWmsLayer[] => {
    const visible: VisibleWmsLayer[] = []
    for (const layer of layerArray) {
      if (layer.type === 'group' && 'layers' in layer) {
        visible.push(...getVisibleWmsLayers(layer.layers || []))
      } else if (layer.type === 'wms' && displayedTitles.has(layer.title || '')) {
        const wmsLayer = layer as WMSLayerProps
        // Join all sublayer names so the export legend covers every sublayer of a
        // composite layer. fetchLegendRulesBySublayer splits on the comma and fetches
        // each — passing only sublayers[0] dropped the rest from the exported legend.
        const sublayerNames = (wmsLayer.sublayers?.map(s => s.name).filter(Boolean) ?? []) as string[]
        if (sublayerNames.length > 0) {
          visible.push({
            title: layer.title || sublayerNames[0],
            layerName: sublayerNames.join(','),
            url: wmsLayer.url || `${PROD_GEOSERVER_URL}/wms`,
            bivariateLegend: layer.bivariateLegend,
          })
        }
      }
    }
    return visible
  }

  const getVisibleCogLayers = (layerArray: LayerProps[]): COGLayerProps[] => {
    const visible: COGLayerProps[] = []
    for (const layer of layerArray) {
      if (layer.type === 'group' && 'layers' in layer) {
        visible.push(...getVisibleCogLayers(layer.layers || []))
      } else if (layer.type === 'cog' && layer.visible) {
        visible.push(layer as COGLayerProps)
      }
    }
    return visible
  }

  const visibleLayers = getVisibleWmsLayers(layers)
  const visibleCogLayers = getVisibleCogLayers(layers)

  // Fetch legend for each visible layer
  for (const layer of visibleLayers) {
    try {
      // Extent params for content-dependent legend (GeoServer feature). hideEmptyRules drops symbols
      // with no features in view. Skip for bivariate layers — we need the full grid regardless.
      const extraParams: Record<string, string> = {}
      if (bounds && !layer.bivariateLegend) {
        extraParams.BBOX = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
        extraParams.CRS = 'EPSG:4326'
        extraParams.WIDTH = String(Math.round(bounds.width))
        extraParams.HEIGHT = String(Math.round(bounds.height))
        extraParams.SRS = 'EPSG:4326'
        extraParams.SRCWIDTH = String(Math.round(bounds.width))
        extraParams.SRCHEIGHT = String(Math.round(bounds.height))
        extraParams.LEGEND_OPTIONS = 'hideEmptyRules:true;countMatched:true'
      }

      // A WMS layer can bundle multiple GeoServer sublayers; fetch each and merge.
      const groups = await fetchLegendRulesBySublayer(layer.url, layer.layerName, extraParams)

      // Bivariate legend: parse grid from bivariate_R_C rule names (always single-sublayer).
      if (layer.bivariateLegend) {
        const rules = groups[0]?.rules ?? []
        if (rules.length === 0) continue
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
              noData,
            }
          })
        }
        continue
      }

      const symbols: LegendItem['symbols'] = []
      for (const { rules } of groups) {
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

  // COG raster colorbars — fetch embedded stats / STAC stats, build a horizontal ramp
  for (const cogLayer of visibleCogLayers) {
    try {
      const meta = await loadCogMetadata(cogLayer.cogUrl, cogLayer.stacUrl)
      if (!meta) continue
      const range = deriveRange(meta, cogLayer.stretchMode ?? 'minmax')
      const n = cogLayer.colorStops.length
      const [rmin, rmax] = range
      const symbolizers: Symbolizer[] = [{
        Raster: {
          colormap: {
            type: 'ramp',
            entries: cogLayer.colorStops.map((color, i) => ({
              color,
              quantity: String(rmin + ((rmax - rmin) * i) / (n - 1)),
              opacity: '1',
              label: '',
            })),
          },
        },
      }]
      const svg = createRasterSymbol(symbolizers, { unit: cogLayer.legendUnit, range })
      const svgHeight = parseFloat(svg.getAttribute('height') ?? '40') || 40
      // Drop the `width="100%"` attribute — svgToImage rasterizes the SVG standalone, so a percentage
      // width has no parent to resolve against. Without an explicit width the colorbar collapses.
      svg.setAttribute('width', '240')
      svg.setAttribute('preserveAspectRatio', 'none')
      results.push({
        layerTitle: cogLayer.title,
        symbols: [],
        raster: { svgHtml: svg.outerHTML, svgHeight },
      })
    } catch (e) {
      console.warn(`Failed to build legend for COG layer ${cogLayer.title}:`, e)
    }
  }

  return results
}

interface GenericMapContainerProps {
  /** Optional CQL filters for WMS layers, keyed by layer title */
  layerFilters?: Record<string, string>
  /** Optional GeoServer style names for WMS layers, keyed by layer title */
  layerStyles?: Record<string, string>
  /** Optional MapLibre filter expressions for vector (WFS) layers, keyed by layer title */
  vectorLayerFilters?: Record<string, maplibregl.FilterSpecification>
  /** Optional active symbology mode key for vector layers, keyed by layer title */
  vectorLayerSymbology?: Record<string, string>
  /** Layer config key (default: 'layers') */
  layerConfigKey?: string
  /** Called when all selections are cleared (context menu, popup close, etc.) */
  onClearSearch?: () => void
  /** Hide attribute table CSV/GeoJSON + per-layer parquet downloads. Used by apps that require unmodified source data only. */
  disableExport?: boolean
}

export default function GenericMapContainer({
  layerFilters = {},
  layerStyles = {},
  vectorLayerFilters = {},
  vectorLayerSymbology = {},
  layerConfigKey = 'layers',
  onClearSearch,
  disableExport = false,
}: GenericMapContainerProps) {
  const isMobile = useIsMobile()
  const currentPage = useGetCurrentPage()
  const popupTitle = POPUP_TITLES[currentPage] ?? 'Results'
  const { viewMode, setViewMode, center, zoom, setMapPosition, basemap, clickBufferBounds, setClickBufferBounds, featureBbox, setFeatureBbox, selectedFeatureRefs, setSelectedFeatureRefs, popupCoords, setPopupCoords } = useMapUrlSync()
  const { setNavOpened } = useSidebar()
  const rawLayersConfig = useGetLayerConfigsData(layerConfigKey)
  const { selectedLayerTitles, groupVisibility } = useLayerUrl()
  const layersConfig = rawLayersConfig || []
  const popupSheetRef = useRef<PopupSheetRef>(null)
  const sheetTriggerRef = useRef<HTMLButtonElement>(null)

  // Currently-displayed titles: leaf is checked AND every enclosing group toggle is on.
  // Used by the legend fetcher to filter WMS layers without re-deriving runtime state.
  const displayedTitles = useMemo(() => {
    const s = new Set<string>()
    for (const { layer, ancestorGroupTitles } of flattenDataLayersWithAncestors(layersConfig)) {
      const { displayed } = resolveLeafVisibility(
        layer.title, ancestorGroupTitles, selectedLayerTitles, groupVisibility,
      )
      if (displayed && layer.title) s.add(layer.title)
    }
    return s
  }, [layersConfig, selectedLayerTitles, groupVisibility])

  // Refs for export control legend callback (stable identity across renders).
  const layersConfigRef = useRef<LayerProps[]>(layersConfig)
  layersConfigRef.current = layersConfig
  const displayedTitlesRef = useRef<Set<string>>(displayedTitles)
  displayedTitlesRef.current = displayedTitles

  // Read draw lifecycle + registrations from context (owned by useMapContextState)
  const {
    map: mapInstance,
    activeDrawShape,
    startDraw,
    cancelDraw,
    handleDrawComplete,
    registerPrepareForDraw,
    registerLayerTurnedOff,
    onMapReady,
  } = useMap()

  // Highlighted features state - controlled by popup/table navigation
  const [highlightedFeatures, setHighlightedFeatures] = useState<HighlightFeature[]>([])

  // Handle map ready callback
  const handleMapReady = useCallback((map: maplibregl.Map) => {
    onMapReady(map)
  }, [onMapReady])

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
  } = useFeatureSelection({
    viewMode,
    selectedFeatureRefs,
    setSelectedFeatureRefs,
    setClickBufferBounds,
    setFeatureBbox,
    popupSheetRef,
    onHighlightChange: handleHighlightChange,
  })

  // Raster-only layers are sampled async in usePopupData (not part of the
  // vector/WMS click features), so their popup can't open at click time. Mark the
  // click as pending; the effect below opens the sheet once raster sampling
  // settles AND there's something to show — so an empty click no longer opens an
  // empty sheet. Vector/WMS results open via useFeatureSelection (gated on hits).
  const awaitingRasterOpenRef = useRef(false)
  const handleClickBufferChange = useCallback((bounds: { sw: [number, number]; ne: [number, number] } | null) => {
    setClickBufferBounds(bounds)
    awaitingRasterOpenRef.current = !!bounds && viewMode === 'map'
  }, [setClickBufferBounds, viewMode])

  // Register layer turned off callback with parent context (safe - callback is stable)
  registerLayerTurnedOff(handleLayerTurnedOff)

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
        getLegendData: (bounds) => fetchLegendDataForVisibleLayers(layersConfigRef.current, displayedTitlesRef.current, bounds)
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

  // Independent interaction states (no longer bundled in mapInteraction)
  const [spatialFilter, setSpatialFilter] = useState<SpatialFilter>(null)
  const [boxSelectMode, setBoxSelectMode] = useState(false)
  const [boxSelectBounds, setBoxSelectBounds] = useState<{ sw: [number, number]; ne: [number, number] } | null>(null)
  const [toolbarDrawShape, setToolbarDrawShape] = useState<DrawMode>('off')

  // Additive mode only active when no other mode is active (shift-click disabled in draw/box modes)
  const noOtherModeActive = activeDrawShape === 'off' && !boxSelectMode
  const isAdditiveMode = noOtherModeActive && (additiveModeToggled || isShiftHeld)

  // One list of per-mode leftovers — every transition below clears all three.
  const clearSelectionState = useCallback(() => {
    setSpatialFilter(null)
    setBoxSelectBounds(null)
    setAdditiveModeToggled(false)
  }, [])

  // Register callback so startDraw can clear conflicting container state
  const prepareForDraw = useCallback(() => {
    clearSelectionState()
    setBoxSelectMode(false)
    setToolbarDrawShape('off')
  }, [clearSelectionState])

  // Register once (safe - callback is stable)
  registerPrepareForDraw(prepareForDraw)

  // Centralized mode setter - handles mutual exclusivity (non-draw modes)
  const setActiveMode = useCallback((
    mode: 'boxSelect' | 'additive' | 'none'
  ) => {
    cancelDraw()
    setToolbarDrawShape('off')
    clearSelectionState()
    setBoxSelectMode(mode === 'boxSelect')
    setAdditiveModeToggled(mode === 'additive')
  }, [cancelDraw, clearSelectionState])

  // Toolbar draw toggle — starts draw via context, tracks highlight locally
  const handleToolbarDrawToggle = useCallback((mode: DrawMode) => {
    setBoxSelectMode(false)
    clearSelectionState()
    if (mode === 'off') {
      cancelDraw()
      setToolbarDrawShape('off')
    } else {
      startDraw(mode, undefined, () => setToolbarDrawShape('off'))
      setToolbarDrawShape(mode)
    }
  }, [cancelDraw, startDraw, clearSelectionState])

  // Called by useTerraDraw when drawing finishes (resets to 'off')
  const handleDrawReset = useCallback(() => {
    cancelDraw()
    setToolbarDrawShape('off')
  }, [cancelDraw])

  // Cancel any active mode (draw, box select, additive)
  const handleCancelMode = useCallback(() => {
    setActiveMode('none')
  }, [setActiveMode])

  const handleSpatialFilterChange = useCallback((filter: SpatialFilter) => {
    setSpatialFilter(filter)
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
    setBoxSelectBounds(bounds)
  }, [])

  // Clear highlights when selections are cleared
  const handleClearAllSelections = useCallback(() => {
    setHighlightedFeatures([])
    clearAllSelections()
    setPopupCoords(null)
    onClearSearch?.()
    setPanelState(prev => ({ ...prev, isSheetOpen: false }))
    setBoxSelectBounds(null)
  }, [clearAllSelections, setPopupCoords, onClearSearch])

  // Derived: click point for raster queries (center of click buffer)
  const clickPoint = useMemo(() => {
    if (!clickBufferBounds) return null
    return getBboxCenter(clickBufferBounds)
  }, [clickBufferBounds])

  // Unified popup data: groups features by layer + fetches raster values
  const { popupData: popupContent, isLoadingRaster } = usePopupData({
    vectorFeatures: selectedFeatures,
    clickPoint,
    clickBbox: clickBufferBounds,
    layersConfig,
    displayedTitles,
  })

  // Derived: has results (includes raster-only layers)
  const hasResults = useMemo(() => popupContent.length > 0, [popupContent])

  // Open the sheet for a pending click once raster sampling settles: only if
  // there are results. No results → no empty sheet. Cleared either way so it
  // fires once per click.
  useEffect(() => {
    if (!awaitingRasterOpenRef.current || isLoadingRaster) return
    awaitingRasterOpenRef.current = false
    if (hasResults && viewMode === 'map') {
      requestAnimationFrame(() => popupSheetRef.current?.open())
    }
  }, [isLoadingRaster, hasResults, viewMode])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'map' && hasResults) {
      requestAnimationFrame(() => popupSheetRef.current?.open())
    }
  }, [setViewMode, hasResults])

  const handleCloseTable = useCallback(() => {
    handleClearAllSelections()
    setViewMode('map')
    setBoxSelectBounds(null)
  }, [handleClearAllSelections, setViewMode])

  const handleSheetClose = useCallback(() => {
    handleClearAllSelections()
    setBoxSelectBounds(null)
  }, [handleClearAllSelections])

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setPanelState(prev => ({ ...prev, isSheetOpen: open }))
  }, [])

  const shouldShrinkMap = viewMode === 'map' && panelState.isSheetOpen && !isMobile

  return (
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
            layerStyles={layerStyles}
            vectorLayerFilters={vectorLayerFilters}
            vectorLayerSymbology={vectorLayerSymbology}
            onMapReady={handleMapReady}
            basemapId={basemap}
            clickBufferBounds={clickBufferBounds}
            onClickBufferChange={handleClickBufferChange}
            featureBbox={featureBbox}
            onFeatureBboxChange={setFeatureBbox}
            activeDrawShape={activeDrawShape}
            onDrawReset={handleDrawReset}
            onDrawComplete={handleDrawComplete}
            toolbarDrawShape={toolbarDrawShape}
            onToolbarDrawToggle={handleToolbarDrawToggle}
            onCancelMode={handleCancelMode}
            spatialFilter={spatialFilter}
            onSpatialFilterChange={handleSpatialFilterChange}
            boxSelectMode={boxSelectMode}
            onBoxSelectModeChange={handleBoxSelectModeChange}
            boxSelectBounds={boxSelectBounds}
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
              clickPoint={clickPoint}
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
              clickPoint={clickPoint}
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
            disableExport={disableExport}
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
}
