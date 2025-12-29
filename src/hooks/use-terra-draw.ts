import { useRef, useEffect } from 'react'
import { TerraDraw, TerraDrawRectangleMode, TerraDrawPolygonMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import type { DrawMode, SpatialFilter } from '@/components/maps/types'

interface UseTerraDrawOptions {
  map: maplibregl.Map | null
  styleLoaded: boolean
  drawMode: DrawMode
  onDrawModeChange?: (mode: DrawMode) => void
  onSpatialFilterChange?: (filter: SpatialFilter) => void
  onDrawFinished?: () => void
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
  onSpatialFilterChange,
  onDrawFinished,
}: UseTerraDrawOptions) {
  const terraDrawRef = useRef<TerraDraw | null>(null)
  const justFinishedDrawingRef = useRef(false)

  // Initialize Terra Draw ONCE when map style is ready
  useEffect(() => {
    if (!map || terraDrawRef.current || !onSpatialFilterChange || !styleLoaded) return

    // Check if TerraDraw sources already exist (from previous mount)
    // Clean up any sources/layers with terra-draw prefixes
    const style = map.getStyle()
    if (style?.layers) {
      for (const layer of [...style.layers]) {
        if (layer.id.startsWith('td-') || layer.id.startsWith('terra-draw')) {
          try { map.removeLayer(layer.id) } catch { /* ignore */ }
        }
      }
    }
    if (style?.sources) {
      for (const sourceId of Object.keys(style.sources)) {
        if (sourceId.startsWith('td-') || sourceId.startsWith('terra-draw')) {
          try { map.removeSource(sourceId) } catch { /* ignore */ }
        }
      }
    }
    const terraDraw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawRectangleMode(),
        new TerraDrawPolygonMode(),
      ],
    })

    terraDraw.start()
    terraDrawRef.current = terraDraw

    // Sync to current draw mode immediately after initialization
    if (drawMode !== 'off') {
      terraDraw.setMode(drawMode)
    }

    // Listen for drawing completion - clear and call callback
    terraDraw.on('finish', (id: string | number) => {
      const snapshot = terraDraw.getSnapshot()
      const feature = snapshot.find(f => f.id === id)
      if (feature) {
        const geometry = feature.geometry as Polygon
        const coords = geometry.coordinates[0]

        // Calculate bbox from polygon coordinates
        const lngs = coords.map(c => c[0])
        const lats = coords.map(c => c[1])
        const bbox: [number, number, number, number] = [
          Math.min(...lngs),
          Math.min(...lats),
          Math.max(...lngs),
          Math.max(...lats),
        ]

        onSpatialFilterChange({
          type: feature.properties?.mode === 'rectangle' ? 'bbox' : 'polygon',
          bbox,
          polygon: geometry,
        })
      }

      // Clear all drawn features and exit draw mode
      terraDraw.clear()
      justFinishedDrawingRef.current = true
      onDrawModeChange?.('off')
      onDrawFinished?.()
    })

    return () => {
      try {
        terraDraw.stop()
      } catch {
        // Map may already be destroyed during HMR or unmount
      }
      terraDrawRef.current = null
    }
  }, [map, onSpatialFilterChange, onDrawModeChange, onDrawFinished, styleLoaded])

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
