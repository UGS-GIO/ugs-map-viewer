import { useEffect, useRef } from 'react'
import { Source, useControl, useMap } from 'react-map-gl/maplibre'
import type * as maplibregl from 'maplibre-gl'
import type { RasterDEMSourceSpecification } from 'maplibre-gl'
import { applyTerrain, TERRAIN_SOURCE_ID, TERRARIUM_TILES } from '@/lib/terrain'

// Spike: free AWS Terrarium DEM; swap for a USGS 3DEP tileset if this ships.
const DEM_SOURCE: RasterDEMSourceSpecification = {
  type: 'raster-dem',
  tiles: [TERRARIUM_TILES],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  // Joerd asks to credit the USGS sources behind US terrain, plus Mapzen for the tileset
  attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: USGS 3DEP, SRTM, GMTED2010 · Mapzen</a>',
}


// MapLibre's default is 60; 85 allows near-horizon views, which need a sky above the horizon
export const MAX_PITCH = 85

export const SKY: maplibregl.SkySpecification = {
  'sky-color': '#88c6fc',
  'horizon-color': '#dceefc',
  'sky-horizon-blend': 0.6,
  'fog-color': '#dceefc',
  // Haze only toward the horizon, so nearby terrain stays crisp
  'fog-ground-blend': 0.9,
  'horizon-fog-blend': 0.6,
}

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

// react-map-gl's terrain prop turns terrain off only with null, which its types forbid, so set it here.
export function Terrain3D({ exaggeration }: { exaggeration: number }) {
  const exaggerationRef = useRef(exaggeration)
  exaggerationRef.current = exaggeration

  useMapLifecycle(
    (map) => applyTerrain(map, exaggerationRef.current),
    // Unmounting before the style loads (StrictMode) leaves nothing to clear, and setTerrain would throw
    (map) => { if (map.getTerrain()) map.setTerrain(null) },
  )
  // The lifecycle only re-applies on sourcedata; URL changes need their own sync
  const { current } = useMap()
  useEffect(() => {
    const map = current?.getMap()
    if (map) applyTerrain(map, exaggeration)
  }, [current, exaggeration])

  return <Source id={TERRAIN_SOURCE_ID} {...DEM_SOURCE} />
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
