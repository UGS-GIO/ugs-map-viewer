import { useRef, useEffect } from 'react'
import { TerraDraw, TerraDrawRectangleMode, TerraDrawPolygonMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import type { DrawMode } from '@/components/maps/types'

// Standardized drawing colors - matches spatial filter layer (orange)
const DRAW_FILL_COLOR = '#f59e0b'
const DRAW_FILL_OPACITY = 0.15
const DRAW_OUTLINE_COLOR = '#f59e0b'
const DRAW_OUTLINE_WIDTH = 2

function isPolygon(geometry: GeoJSON.Geometry): geometry is Polygon {
  return geometry.type === 'Polygon'
}

interface UseTerraDrawOptions {
  map: maplibregl.Map | null
  styleLoaded: boolean
  drawMode: DrawMode
  onDrawModeChange?: (mode: DrawMode) => void
  /** Called when a drawing is completed with the         relatedDataMaps: import('@/hooks/use-bulk-related-table').RelatedDataMap[];
polygon geometry */
  onDrawFinished?: (polygon: Polygon, mode: 'rectangle' | 'polygon') => void
}

/**
 * Hook to manage Terra Draw lifecycle and mode switching
 * Returns a ref that tracks when drawing just finished (for click suppression)
 */
export function useTerraDraw({
  map,
  styleLoaded,
  drawMode,
  onDrawModeChange,
  onDrawFinished,
}: UseTerraDrawOptions) {
  const terraDrawRef = useRef<TerraDraw | null>(null)
  const justFinishedDrawingRef = useRef(false)

  // Stable refs for callbacks — prevents Terra Draw teardown/rebuild on callback identity changes
  const onDrawModeChangeRef = useRef(onDrawModeChange)
  onDrawModeChangeRef.current = onDrawModeChange
  const onDrawFinishedRef = useRef(onDrawFinished)
  onDrawFinishedRef.current = onDrawFinished

  // Helper to clean up existing Terra Draw sources/layers
  const cleanupTerraDrawLayers = (mapInstance: maplibregl.Map) => {
    const style = mapInstance.getStyle()
    if (style?.layers) {
      for (const layer of [...style.layers]) {
        if (layer.id.startsWith('td-') || layer.id.startsWith('terra-draw')) {
          try { mapInstance.removeLayer(layer.id) } catch { /* ignore */ }
        }
      }
    }
    if (style?.sources) {
      for (const sourceId of Object.keys(style.sources)) {
        if (sourceId.startsWith('td-') || sourceId.startsWith('terra-draw')) {
          try { mapInstance.removeSource(sourceId) } catch { /* ignore */ }
        }
      }
    }
  }

  // Helper to create and start Terra Draw
  const createTerraDraw = (mapInstance: maplibregl.Map) => {
    cleanupTerraDrawLayers(mapInstance)

    const terraDraw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map: mapInstance }),
      modes: [
        new TerraDrawRectangleMode({
          styles: {
            fillColor: DRAW_FILL_COLOR,
            fillOpacity: DRAW_FILL_OPACITY,
            outlineColor: DRAW_OUTLINE_COLOR,
            outlineWidth: DRAW_OUTLINE_WIDTH,
          },
          cursors: { start: 'crosshair' },
        }),
        new TerraDrawPolygonMode({
          styles: {
            fillColor: DRAW_FILL_COLOR,
            fillOpacity: DRAW_FILL_OPACITY,
            outlineColor: DRAW_OUTLINE_COLOR,
            outlineWidth: DRAW_OUTLINE_WIDTH,
            closingPointColor: DRAW_OUTLINE_COLOR,
            closingPointWidth: 6,
            closingPointOutlineColor: '#ffffff',
            closingPointOutlineWidth: 2,
          },
          cursors: { start: 'crosshair', close: 'pointer' },
        }),
      ],
    })

    terraDraw.start()
    return terraDraw
  }

  // Initialize Terra Draw when map + style are ready (stable deps only)
  useEffect(() => {
    if (!map || !styleLoaded) return

    // Stop existing Terra Draw if present (handles style reloads)
    if (terraDrawRef.current) {
      try { terraDrawRef.current.stop() } catch { /* ignore */ }
      terraDrawRef.current = null
    }

    const terraDraw = createTerraDraw(map)
    terraDrawRef.current = terraDraw

    // Sync to current draw mode immediately after initialization
    if (drawMode !== 'off') {
      terraDraw.setMode(drawMode)
    }

    // Listen for drawing completion - emit polygon and reset
    terraDraw.on('finish', (id: string | number) => {
      const snapshot = terraDraw.getSnapshot()
      const feature = snapshot.find(f => f.id === id)
      if (feature && isPolygon(feature.geometry)) {
        const mode = feature.properties?.mode === 'rectangle' ? 'rectangle' : 'polygon'
        onDrawFinishedRef.current?.(feature.geometry, mode)
      }

      terraDraw.clear()
      justFinishedDrawingRef.current = true
      onDrawModeChangeRef.current?.('off')
    })

    // Handle map style changes (basemap switches) - reinitialize Terra Draw
    const handleStyleData = () => {
      // Check if our Terra Draw layers still exist
      const style = map.getStyle()
      const hasTdLayers = style?.layers?.some(l => l.id.startsWith('td-'))

      // If style changed and we lost our layers, reinitialize
      if (!hasTdLayers && terraDrawRef.current) {
        try { terraDrawRef.current.stop() } catch { /* ignore */ }
        const newTerraDraw = createTerraDraw(map)
        terraDrawRef.current = newTerraDraw

        // Restore current mode
        if (drawMode !== 'off') {
          newTerraDraw.setMode(drawMode)
        }
      }
    }
    map.on('styledata', handleStyleData)

    return () => {
      map.off('styledata', handleStyleData)
      try {
        terraDraw.stop()
      } catch {
        // Map may already be destroyed during HMR or unmount
      }
      terraDrawRef.current = null
    }
  }, [map, styleLoaded])

  // Handle draw mode changes - setMode() instead of reinitializing
  useEffect(() => {
    const terraDraw = terraDrawRef.current
    if (!terraDraw) return

    // Clear any in-progress drawing when switching modes
    try { terraDraw.clear() } catch { /* ignore */ }

    if (drawMode === 'off') {
      terraDraw.setMode('static')
    } else {
      terraDraw.setMode(drawMode)
    }
  }, [drawMode])

  return { justFinishedDrawingRef }
}
