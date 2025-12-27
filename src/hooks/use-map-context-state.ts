import { useState, useCallback, useRef, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import type { MapContextProps, DrawMode } from '@/context/map-context'
import type { Polygon } from 'geojson'

/**
 * Hook to manage MapContext state at the page level
 * This allows components outside GenericMapContainer (like SearchCombobox) to access the map
 */
export function useMapContextState() {
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | undefined>(undefined)
  const [isSketching, setIsSketching] = useState(false)
  const [drawMode, setDrawMode] = useState<DrawMode>('off')
  const ignoreNextClickRef = useRef(false)
  const layerTurnedOffCallbackRef = useRef<((layerTitle: string) => void) | undefined>(undefined)
  const externalDrawCallbackRef = useRef<((polygon: Polygon) => void) | null>(null)
  const clearSpatialFilterRef = useRef<(() => void) | undefined>(undefined)

  const shouldIgnoreNextClick = useCallback(() => ignoreNextClickRef.current, [])
  const setIgnoreNextClick = useCallback((ignore: boolean) => { ignoreNextClickRef.current = ignore }, [])
  const consumeIgnoreClick = useCallback(() => { ignoreNextClickRef.current = false }, [])

  const handleMapReady = useCallback((map: maplibregl.Map) => {
    setMapInstance(map)
  }, [])

  // Allow GenericMapContainer to register the layer callback
  const setLayerTurnedOffCallback = useCallback((callback: (layerTitle: string) => void) => {
    layerTurnedOffCallbackRef.current = callback
  }, [])

  const onLayerTurnedOff = useCallback((layerTitle: string) => {
    layerTurnedOffCallbackRef.current?.(layerTitle)
  }, [])

  // Allow GenericMapContainer to register the clear spatial filter callback
  const setClearSpatialFilterCallback = useCallback((callback: () => void) => {
    clearSpatialFilterRef.current = callback
  }, [])

  // Draw controls - shared between report generator and map tools
  const startDraw = useCallback((mode: 'rectangle' | 'polygon', onComplete: (polygon: Polygon) => void) => {
    // Clear any existing drawing/filter before starting new one
    clearSpatialFilterRef.current?.()
    externalDrawCallbackRef.current = onComplete
    setDrawMode(mode)
  }, [])

  const cancelDraw = useCallback(() => {
    externalDrawCallbackRef.current = null
    setDrawMode('off')
  }, [])

  // Called by GenericMapContainer when a spatial filter is set (drawing completed)
  const handleDrawComplete = useCallback((polygon: Polygon) => {
    if (externalDrawCallbackRef.current) {
      externalDrawCallbackRef.current(polygon)
      externalDrawCallbackRef.current = null
    }
  }, [])

  const contextValue: MapContextProps = useMemo(() => ({
    map: mapInstance,
    isSketching,
    setIsSketching,
    getIsSketching: () => isSketching,
    shouldIgnoreNextClick,
    setIgnoreNextClick,
    consumeIgnoreClick,
    onLayerTurnedOff,
    drawMode,
    startDraw,
    cancelDraw,
  }), [mapInstance, isSketching, shouldIgnoreNextClick, setIgnoreNextClick, consumeIgnoreClick, onLayerTurnedOff, drawMode, startDraw, cancelDraw])

  return {
    mapInstance,
    handleMapReady,
    contextValue,
    setLayerTurnedOffCallback,
    setClearSpatialFilterCallback,
    drawMode,
    setDrawMode,
    handleDrawComplete,
  }
}
