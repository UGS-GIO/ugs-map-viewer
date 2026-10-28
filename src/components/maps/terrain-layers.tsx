import { useRef } from 'react'
import { Source, useControl } from 'react-map-gl/maplibre'
import type * as maplibregl from 'maplibre-gl'
import type { RasterDEMSourceSpecification } from 'maplibre-gl'

// Spike: free AWS Terrarium DEM; swap for a USGS 3DEP tileset if this ships.
const DEM_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  // Joerd asks to credit the USGS sources behind US terrain, plus Mapzen for the tileset
  attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: USGS 3DEP, SRTM, GMTED2010 · Mapzen</a>',
}

const TERRAIN = { source: 'terrain-dem', exaggeration: 1.5 }

const HILLSHADE: maplibregl.HillshadeLayerSpecification = {
  id: 'terrain-hillshade',
  type: 'hillshade',
  // Separate source: MapLibre renders hillshade blurry when it shares the terrain DEM
  source: 'hillshade-dem',
  paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#473B24' },
}

/**
 * Adds a control whose only job is map lifecycle: `apply` runs on every sourcedata so it re-attaches
 * after basemap swaps (once react-map-gl has re-added our sources), and `clear` runs on unmount.
 */
function useMapLifecycle(apply: (map: maplibregl.Map) => void, clear: (map: maplibregl.Map) => void) {
  useControl(() => {
    const onSourceData = ({ target }: { target: maplibregl.Map }) => apply(target)
    return {
      onAdd(map: maplibregl.Map) {
        map.on('sourcedata', onSourceData)
        apply(map)
        return document.createElement('div')
      },
      onRemove(map: maplibregl.Map) {
        map.off('sourcedata', onSourceData)
        clear(map)
      },
    }
  })
}

// react-map-gl's terrain prop can't turn terrain off (undefined is a no-op), so set it here.
export function Terrain3D() {
  useMapLifecycle(
    (map) => { if (map.getSource(TERRAIN.source) && !map.getTerrain()) map.setTerrain(TERRAIN) },
    // Unmounting before the style loads (StrictMode) leaves nothing to clear, and setTerrain would throw
    (map) => { if (map.getTerrain()) map.setTerrain(null) },
  )
  return <Source id={TERRAIN.source} {...DEM_SOURCE} />
}

// Under the basemap's labels; raster basemaps have none, so under the bottom data layer.
export function Hillshade({ bottomDataLayerId }: { bottomDataLayerId: string | undefined }) {
  const bottomDataLayerIdRef = useRef(bottomDataLayerId)
  bottomDataLayerIdRef.current = bottomDataLayerId

  useMapLifecycle(
    (map) => {
      if (!map.getSource(HILLSHADE.source) || map.getLayer(HILLSHADE.id)) return
      const firstLabelId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      const beforeId = firstLabelId ?? bottomDataLayerIdRef.current
      // Data layers re-mount after a basemap swap; wait for the next sourcedata rather than land on top
      if (beforeId && !map.getLayer(beforeId)) return
      map.addLayer(HILLSHADE, beforeId)
    },
    (map) => { if (map.getLayer(HILLSHADE.id)) map.removeLayer(HILLSHADE.id) },
  )
  return <Source id={HILLSHADE.source} {...DEM_SOURCE} />
}
