import { useState, useCallback, useRef, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import type { MapContextProps, DrawMode } from '@/context/map-context'
import type { Polygon } from 'geojson'
import { useMapInstance } from '@/context/map-instance-context'

/**
 * Hook to manage MapContext state at the page level.
 * Single owner of the draw lifecycle — container and sidebar consumers read from context.
 */
export function useMapContextState() {
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | undefined>(undefined)
  const [isSketching, setIsSketching] = useState(false)
  const [drawMode, setDrawModeState] = useState<DrawMode>('off')
  const { setMap: setMapInstanceGlobal } = useMapInstance()

  const layerTurnedOffCallbackRef = useRef<((layerTitle: string) => void) | undefined>(undefined)
  const externalDrawCallbackRef = useRef<((polygon: Polygon) => void) | null>(null)
  const externalDrawCancelRef = useRef<(() => void) | null>(null)
  const clearSpatialFilterRef = useRef<(() => void) | undefined>(undefined)

  // Track whether an external caller (report generator) is drawing
  const [isExternalDrawActive, setIsExternalDrawActive] = useState(false)

  // Container forwards map instance here
  const onMapReady = useCallback((map: maplibregl.Map) => {
    setMapInstance(map)
    setMapInstanceGlobal(map)
  }, [setMapInstanceGlobal])

  // Container registers its layer-turned-off handler
  const registerLayerTurnedOff = useCallback((callback: (layerTitle: string) => void) => {
    layerTurnedOffCallbackRef.current = callback
  }, [])

  const onLayerTurnedOff = useCallback((layerTitle: string) => {
    layerTurnedOffCallbackRef.current?.(layerTitle)
  }, [])

  // Container registers its clear-spatial-filter handler
  const registerClearSpatialFilter = useCallback((callback: () => void) => {
    clearSpatialFilterRef.current = callback
  }, [])

  // Called by toolbar — cancels any active external draw, then sets mode
  const setDrawMode = useCallback((mode: DrawMode) => {
    if (externalDrawCallbackRef.current) {
      externalDrawCancelRef.current?.()
      externalDrawCallbackRef.current = null
      externalDrawCancelRef.current = null
      setIsExternalDrawActive(false)
    }
    setDrawModeState(mode)
  }, [])

  // External callers (report generator) start a draw session
  const startDraw = useCallback((mode: 'rectangle' | 'polygon', onComplete: (polygon: Polygon) => void, onCancel?: () => void) => {
    clearSpatialFilterRef.current?.()
    externalDrawCallbackRef.current = onComplete
    externalDrawCancelRef.current = onCancel ?? null
    setIsExternalDrawActive(true)
    setDrawModeState(mode)
  }, [])

  const cancelDraw = useCallback(() => {
    externalDrawCallbackRef.current = null
    externalDrawCancelRef.current = null
    setIsExternalDrawActive(false)
    setDrawModeState('off')
  }, [])

  // Called by Terra Draw when external draw finishes (skips spatial filter pipeline)
  const handleDrawComplete = useCallback((polygon: Polygon) => {
    if (externalDrawCallbackRef.current) {
      externalDrawCallbackRef.current(polygon)
      externalDrawCallbackRef.current = null
    }
    setIsExternalDrawActive(false)
  }, [])

  // onDrawComplete is non-null only when an external caller is drawing
  const onDrawComplete = isExternalDrawActive ? handleDrawComplete : undefined

  const contextValue: MapContextProps = useMemo(() => ({
    map: mapInstance,
    isSketching,
    setIsSketching,
    onLayerTurnedOff,
    drawMode,
    setDrawMode,
    startDraw,
    cancelDraw,
    onDrawComplete,
    registerClearSpatialFilter,
    registerLayerTurnedOff,
    onMapReady,
  }), [mapInstance, isSketching, onLayerTurnedOff, drawMode, setDrawMode, startDraw, cancelDraw, onDrawComplete, registerClearSpatialFilter, registerLayerTurnedOff, onMapReady])

  return { contextValue }
}
