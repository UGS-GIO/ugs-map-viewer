/**
 * Generic Map Container - Shared component for all map pages
 * Uses react-map-gl DataMap with unified state management
 * Reads draw lifecycle and registrations from MapContext (owned by useMapContextState)
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as maplibregl from 'maplibre-gl'
import DataMap, { HighlightFeature, DrawMode, SpatialFilter, type PMTilesStyleOverride } from '@/components/maps/data-map'
import { PopupSheet, PopupSheetRef } from '@/components/maps/popups/popup-sheet'
import type { LayerContentProps, ExtendedFeature } from '@/components/maps/popups/types'
import { QueryResultsTable } from '@/components/data-table/query-results-table'
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs'
import { useLayerUrl } from '@/context/layer-url-provider'
import { flattenDataLayersWithAncestors, resolveLeafVisibility } from '@/lib/map/layer-utils'
import { useMapUrlSync, type ViewMode } from '@/hooks/use-map-url-sync'
import { useIsMobile } from '@/hooks/use-mobile'
import { PopupContentWithPagination } from '@/components/maps/popups/popup-content-with-pagination'
import { PhoneSheetHost } from './phone-sheet/phone-sheet-host'
import { usePhoneSheet } from './phone-sheet/use-phone-sheet'
import { HALF, raise, SHEET_FRACTION } from './phone-sheet/sheet-model'
import { cn } from '@/lib/utils'
import { PROD_GEOSERVER_URL, POPUP_TITLES } from '@/lib/constants'
import { useMap } from '@/hooks/use-map'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { useAppBasemaps } from '@/hooks/use-app-basemaps'
import { MapChromeControls } from '@/components/maps/controls/map-chrome-controls'
import type { LegendItem } from '@/components/maps/controls'
import { useFeatureSelection } from '@/hooks/use-feature-selection'
import { rasterQueries, usePopupData } from '@/hooks/use-popup-data'
import { getBboxCenter } from '@/lib/map/conversion-utils'
import type { LayerProps, WMSLayerProps, COGLayerProps } from '@/lib/types/mapping-types'
import { createSVGSymbol } from '@/lib/legend/symbol-generator'
import { createRasterSymbol } from '@/lib/legend/symbolizers/raster'
import { loadCogMetadata, deriveRange } from '@/hooks/use-cog-metadata'
import type { Legend, Symbolizer } from '@/lib/types/geoserver-types'

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

// Room kept between a tapped spot and the top of the phone sheet.
const TAP_MARGIN_PX = 32

// One empty list while configs load, so hooks keyed on it don't re-run every render.
const NO_LAYERS: LayerProps[] = []

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
              noData,
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
  /** Optional style overrides for PMTiles layers (e.g. choropleth fill-color), keyed by layer title */
  pmtilesStyleOverrides?: Record<string, PMTilesStyleOverride>
  /** Layer config key (default: 'layers') */
  layerConfigKey?: string
  /** Called when all selections are cleared (context menu, popup close, etc.) */
  onClearSearch?: () => void
  /** Hide attribute table CSV/GeoJSON + per-layer parquet downloads. Used by apps that require unmodified source data only. */
  disableExport?: boolean
  /** Optional render-prop for content shown in the popup sheet header */
  popupHeaderRender?: (popupContent: LayerContentProps[]) => React.ReactNode
  /** Optional render-prop for content shown under each layer's heading in the popup */
  popupLayerHeaderRender?: (layer: LayerContentProps) => React.ReactNode
  /** Optional render-prop for content shown inside each feature card in the popup */
  popupFeatureRender?: (feature: ExtendedFeature, layer: LayerContentProps) => React.ReactNode
  /** Optional predicate; features for which it returns false are hidden from the popup */
  popupFeatureFilter?: (feature: ExtendedFeature, layer: LayerContentProps) => boolean
}

export default function GenericMapContainer({
  layerFilters = {},
  layerStyles = {},
  vectorLayerFilters = {},
  vectorLayerSymbology = {},
  pmtilesStyleOverrides = {},
  layerConfigKey = 'layers',
  onClearSearch,
  disableExport = false,
  popupHeaderRender,
  popupLayerHeaderRender,
  popupFeatureRender,
  popupFeatureFilter,
}: GenericMapContainerProps) {
  const isMobile = useIsMobile()
  const currentPage = useGetCurrentPage()
  const { defaultStyle: defaultBasemap } = useAppBasemaps()
  const popupTitle = POPUP_TITLES[currentPage] ?? 'Results'
  const { viewMode, setViewMode, center, zoom, setMapPosition, basemap, clickBufferBounds, setClickBufferBounds, featureBbox, setFeatureBbox, selectedFeatureRefs, setSelectedFeatureRefs, popupCoords, setPopupCoords } = useMapUrlSync()
  // Phones select straight from the map, whatever a desktop link's `view` still says.
  const selectionView: ViewMode = isMobile ? 'map' : viewMode
  const phoneSheet = usePhoneSheet()
  const { raiseResults, showResults, peek } = phoneSheet
  const rawLayersConfig = useGetLayerConfigsData(layerConfigKey)
  const { selectedLayerTitles, groupVisibility } = useLayerUrl()
  const layersConfig = rawLayersConfig ?? NO_LAYERS
  const popupSheetRef = useRef<PopupSheetRef>(null)
  // Phones and desktop share this tree down to the map, so crossing the phone query never remounts it.
  const mapAreaRef = useRef<HTMLDivElement | null>(null)
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
    registerSelectFeatures,
    registerClearSelections,
    onMapReady,
  } = useMap()

  // Highlighted features state - controlled by popup/table navigation
  const [highlightedFeatures, setHighlightedFeatures] = useState<HighlightFeature[]>([])

  // Where the last map tap landed, for keeping it in view once Results rises over the map.
  const tapCenter = useRef<{ lng: number; lat: number } | null>(null)
  // A selection raises the desktop popup panel, or on phones the sheet's Results, keeping the
  // user's Cards or Table choice. If the half sheet would cover the tapped spot, the map pans it
  // to the middle of the map left above the sheet. It never zooms, so a big polygon keeps its zoom.
  const openResults = useCallback(() => {
    if (!isMobile) return popupSheetRef.current?.open()
    const detent = raise(phoneSheet.state.detent)
    raiseResults('cards')
    const area = mapAreaRef.current
    const tap = tapCenter.current
    if (!mapInstance || !area || !tap || detent !== HALF) return
    const visibleHeight = area.clientHeight * (1 - SHEET_FRACTION.half)
    const { y } = mapInstance.project([tap.lng, tap.lat])
    if (y > visibleHeight - TAP_MARGIN_PX) mapInstance.panBy([0, y - visibleHeight / 2])
  }, [isMobile, raiseResults, phoneSheet.state.detent, mapInstance])

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
    viewMode: selectionView,
    selectedFeatureRefs,
    setSelectedFeatureRefs,
    setClickBufferBounds,
    setFeatureBbox,
    openResults,
    onHighlightChange: handleHighlightChange,
  })

  // Raster-only layers are sampled async (not part of the vector/WMS click features), so their
  // results can't open at click time. The click waits on the same queries usePopupData reads and
  // opens the results only if a raster layer has a value there, so an empty click opens nothing.
  // Vector/WMS results open via useFeatureSelection (gated on hits). A newer click wins.
  const queryClient = useQueryClient()
  const latestClick = useRef(0)
  const handleClickBufferChange = useCallback((bounds: { sw: [number, number]; ne: [number, number] } | null) => {
    setClickBufferBounds(bounds)
    const click = ++latestClick.current
    tapCenter.current = bounds && getBboxCenter(bounds)
    if (!bounds || selectionView !== 'map') return
    const queries = rasterQueries(layersConfig, displayedTitles, getBboxCenter(bounds), bounds)
    // One failed layer must not stop the others' results from opening.
    void Promise.allSettled(queries.map((q) => queryClient.fetchQuery(q))).then((results) => {
      if (click === latestClick.current && results.some((r) => r.status === 'fulfilled' && r.value.data)) openResults()
    })
  }, [setClickBufferBounds, selectionView, layersConfig, displayedTitles, queryClient, openResults])

  // Register callbacks with parent context
  useEffect(() => {
    registerLayerTurnedOff(handleLayerTurnedOff)
    registerSelectFeatures(handleFeatureClick)
    registerClearSelections(clearAllSelections)
  }, [
    registerLayerTurnedOff,
    handleLayerTurnedOff,
    registerSelectFeatures,
    handleFeatureClick,
    registerClearSelections,
    clearAllSelections,
  ])

  // Legend data for the export control; reads the refs so the control never needs re-creating.
  const getLegendData = useCallback(
    (bounds: MapBounds) => fetchLegendDataForVisibleLayers(layersConfigRef.current, displayedTitlesRef.current, bounds),
    [],
  )

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

  useEffect(() => {
    registerPrepareForDraw(prepareForDraw)
  }, [registerPrepareForDraw, prepareForDraw])

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
      // Map tools need the map: on phones the sheet drops to its peek.
      peek()
    }
  }, [cancelDraw, startDraw, clearSelectionState, peek])

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
      showResults('table')
    }
  }, [clearAllSelections, showResults])

  // Handler for box select toggle from toolbar
  const handleBoxSelectModeChange = useCallback((active: boolean) => {
    setActiveMode(active ? 'boxSelect' : 'none')
    // The box sits at the map's center: on phones the sheet drops to its peek so all of it shows.
    if (active) peek()
  }, [setActiveMode, peek])

  const handleBoxSelectConfirm = useCallback((bounds: { sw: [number, number]; ne: [number, number] }) => {
    setBoxSelectBounds(bounds)
    showResults('table')
  }, [showResults])

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
  const { popupData: rawPopupContent, isLoadingRaster } = usePopupData({
    vectorFeatures: selectedFeatures,
    clickPoint,
    clickBbox: clickBufferBounds,
    layersConfig,
    displayedTitles,
  })

  // Apply optional per-feature filter so map cql changes (e.g. a year filter) also
  // hide non-matching feature cards from the popup. Layers without vector features
  // pass through untouched.
  const popupContent = useMemo(() => {
    if (!popupFeatureFilter) return rawPopupContent
    return rawPopupContent.map(layer => ({
      ...layer,
      features: layer.features?.filter(f => popupFeatureFilter(f, layer)),
    }))
  }, [rawPopupContent, popupFeatureFilter])

  // Derived: has results (includes raster-only layers)
  const hasResults = useMemo(() => popupContent.length > 0, [popupContent])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'map' && hasResults) {
      requestAnimationFrame(() => openResults())
    }
  }, [setViewMode, hasResults, openResults])

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

  const shouldShrinkMap = !isMobile && viewMode === 'map' && panelState.isSheetOpen

  const mapElement = (
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
      pmtilesStyleOverrides={pmtilesStyleOverrides}
      onMapReady={handleMapReady}
      basemapId={basemap ?? defaultBasemap.id}
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
      viewMode={isMobile ? undefined : viewMode}
      onViewModeChange={isMobile ? undefined : handleViewModeChange}
      hasResults={hasResults}
    >
      <MapChromeControls isMobile={isMobile} getLegendData={getLegendData} />
    </DataMap>
  )

  // The results table, as both the desktop table panel and the phone sheet's Table view show it.
  const tableProps = {
    layerContent: popupContent,
    selectedFeatureRefs,
    onSelectedFeaturesChange: setSelectedFeatureRefs,
    onHighlightChange: handleHighlightChange,
    disableExport,
  }

  const resultsView = phoneSheet.state.results ?? 'cards'
  const resultsCount = popupContent.reduce((n, layer) => n + (layer.features ? layer.features.length : 1), 0)

  const phoneSheetHost = isMobile && (
      <PhoneSheetHost
        container={mapAreaRef}
        resultsSummary={hasResults ? `${resultsCount} result${resultsCount === 1 ? '' : 's'}` : undefined}
        layersSummary={`${displayedTitles.size} layer${displayedTitles.size === 1 ? '' : 's'} on`}
        results={
          hasResults ? (
            <div className="flex h-full min-h-0 flex-col gap-3 pt-1">
              {popupHeaderRender?.(popupContent)}
              {resultsView === 'cards' ? (
                <PopupContentWithPagination
                  layerContent={popupContent}
                  onHighlightChange={handleHighlightChange}
                  clickPoint={clickPoint}
                  layerHeaderExtras={popupLayerHeaderRender}
                  featureExtras={popupFeatureRender}
                />
              ) : (
                <div className="min-h-[18rem] flex-1">
                  <QueryResultsTable {...tableProps} />
                </div>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isLoadingRaster ? 'Loading results' : "Tap the map to see what's there."}
            </p>
          )
        }
      />
  )

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Map + Drawer row */}
      <div
        ref={mapAreaRef}
        className="relative flex min-h-0 overflow-hidden"
        style={{
          flex: selectionView === 'table' ? '0 0 0%'
            : selectionView === 'split' ? `1 1 ${100 - panelState.tablePanelSize}%`
            : '1 1 100%'
        }}
      >
        {/* Map section */}
        <div
          data-tour={isMobile ? 'phone-map' : undefined}
          data-sheet={isMobile ? phoneSheet.state.detent : undefined}
          className={cn('relative h-full overflow-hidden transition-[width] duration-200 ease-linear', isMobile && 'phone-map')}
          style={{ width: shouldShrinkMap ? `calc(100% - ${panelState.sheetWidth}px)` : '100%' }}
        >
          {mapElement}
        </div>

        {/* Popup sheet - desktop */}
        {!isMobile && viewMode === 'map' && (
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
              headerExtras={popupHeaderRender?.(popupContent)}
              layerHeaderExtras={popupLayerHeaderRender}
              featureExtras={popupFeatureRender}
            />
          </div>
        )}
      </div>

      {phoneSheetHost}

      {/* Resize handle - only in split mode */}
      {!isMobile && viewMode === 'split' && (
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
      {!isMobile && <div
        className="bg-background border-t overflow-hidden min-h-0 min-w-0 w-full"
        style={{
          flex: viewMode === 'map' ? '0 0 0%'
            : viewMode === 'split' ? `1 1 ${panelState.tablePanelSize}%`
            : '1 1 0%'
        }}
      >
        {(viewMode === 'split' || viewMode === 'table') && (
          <QueryResultsTable
            {...tableProps}
            onClose={handleCloseTable}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        )}
      </div>}
    </div>
  )
}
