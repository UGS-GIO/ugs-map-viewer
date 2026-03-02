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
  const [activeDrawShape, setActiveDrawShape] = useState<DrawMode>('off')
  const { setMap: setMapInstanceGlobal } = useMapInstance()

  const layerTurnedOffCallbackRef = useRef<((layerTitle: string) => void) | undefined>(undefined)
  const drawCallbackRef = useRef<((polygon: Polygon) => void) | null>(null)
  const drawCancelRef = useRef<(() => void) | null>(null)
  const prepareForDrawRef = useRef<(() => void) | undefined>(undefined)

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
  const registerPrepareForDraw = useCallback((callback: () => void) => {
    prepareForDrawRef.current = callback
  }, [])

  // Start a draw session. Cancels any existing draw first.
  const startDraw = useCallback((mode: 'rectangle' | 'polygon', onComplete?: (polygon: Polygon) => void, onCancel?: () => void) => {
    drawCancelRef.current?.()
    prepareForDrawRef.current?.()
    drawCallbackRef.current = onComplete ?? null
    drawCancelRef.current = onCancel ?? null
    setActiveDrawShape(mode)
  }, [])

  const cancelDraw = useCallback(() => {
    drawCancelRef.current?.()
    drawCallbackRef.current = null
    drawCancelRef.current = null
    setActiveDrawShape('off')
  }, [])

  // Returns true if an external caller consumed the polygon, false for spatial filter fallthrough
  const handleDrawComplete = useCallback((polygon: Polygon): boolean => {
    const callback = drawCallbackRef.current
    drawCallbackRef.current = null
    drawCancelRef.current = null
    if (callback) {
      callback(polygon)
      return true
    }
    return false
  }, [])

  const contextValue: MapContextProps = useMemo(() => ({
    map: mapInstance,
    isSketching,
    setIsSketching,
    onLayerTurnedOff,
    activeDrawShape,
    startDraw,
    cancelDraw,
    handleDrawComplete,
    registerPrepareForDraw,
    registerLayerTurnedOff,
    onMapReady,
  }), [mapInstance, isSketching, onLayerTurnedOff, activeDrawShape, startDraw, cancelDraw, handleDrawComplete, registerPrepareForDraw, registerLayerTurnedOff, onMapReady])

  return { contextValue }
}
