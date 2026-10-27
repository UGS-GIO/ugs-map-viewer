import { lazy, Suspense } from 'react'
import { GeolocateControl, Source, useControl } from 'react-map-gl/maplibre'
import { TerrainControl } from 'maplibre-gl'
import { HomeControl } from './home-control'
import { DualScaleControl } from './dual-scale-control'
import type { GetLegendData } from './export-control'

const ExportMapControl = lazy(() => import('./export-map-control'))

function HomeMapControl() {
  useControl(() => new HomeControl(), { position: 'top-left' })
  return null
}

function ScaleMapControl() {
  useControl(() => new DualScaleControl({ maxWidth: 150 }), { position: 'bottom-left' })
  return null
}

const TERRAIN_SOURCE_ID = 'terrain-dem'

// Spike: free AWS Terrarium DEM; swap for a USGS 3DEP tileset if this ships.
function TerrainMapControl() {
  useControl(() => new TerrainControl({ source: TERRAIN_SOURCE_ID, exaggeration: 1.5 }), { position: 'top-left' })
  return (
    <Source
      id={TERRAIN_SOURCE_ID}
      type="raster-dem"
      tiles={['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}
      encoding="terrarium"
      tileSize={256}
      maxzoom={15}
      attribution='<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen/AWS</a>'
    />
  )
}

/**
 * Home, locate-me, scale and export, rendered inside <DataMap> so react-map-gl adds and removes
 * them. Phones get home and locate-me only, with locate-me bottom-right in thumb reach above the
 * sheet and the user's dot shown, as map apps do.
 */
export function MapChromeControls({ isMobile, getLegendData }: { isMobile: boolean; getLegendData?: GetLegendData }) {
  return (
    <>
      <HomeMapControl />
      {/* Keyed: react-map-gl reads a control's position only when it mounts. */}
      <GeolocateControl
        key={isMobile ? 'phone' : 'desktop'}
        position={isMobile ? 'bottom-right' : 'top-left'}
        showUserLocation={isMobile}
        showAccuracyCircle={false}
        fitBoundsOptions={{ maxZoom: 18 }}
      />
      {!isMobile && (
        <>
          <ScaleMapControl />
          <TerrainMapControl />
          <Suspense fallback={null}>
            <ExportMapControl getLegendData={getLegendData} />
          </Suspense>
        </>
      )}
    </>
  )
}
