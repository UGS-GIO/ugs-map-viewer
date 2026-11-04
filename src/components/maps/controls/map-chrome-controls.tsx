import { lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { GeolocateControl, useControl } from 'react-map-gl/maplibre'
import { HomeControl } from './home-control'
import { MapHistoryControl } from './map-history-control'
import { appHistory, appSteps, appSharedStops } from '@/lib/map/app-history'
import { MapStepsPopover } from './map-steps-popover'
import { DualScaleControl } from './dual-scale-control'
import { NavigationMapControl } from './navigation-map-control'
import type { GetLegendData } from './export-control'

const ExportMapControl = lazy(() => import('./export-map-control'))
const MeasureMapControl = lazy(() => import('./measure-map-control'))

function HomeMapControl() {
  useControl(() => new HomeControl(), { position: 'top-left' })
  return null
}

function MapHistoryMapControl({ getLegendData }: { getLegendData?: GetLegendData }) {
  const control = useControl(() => new MapHistoryControl(appHistory), { position: 'top-left' })
  return createPortal(<MapStepsPopover steps={appSteps} shared={appSharedStops} getLegendData={getLegendData} />, control.container)
}

function ScaleMapControl() {
  useControl(() => new DualScaleControl({ maxWidth: 150 }), { position: 'bottom-left' })
  return null
}

/**
 * Zoom/compass/3D, home, back/forward, locate-me, scale and export, rendered inside <DataMap> so react-map-gl adds
 * and removes them. Phones skip scale and export, with locate-me bottom-right in thumb reach above the
 * sheet and the user's dot shown, as map apps do.
 */
export function MapChromeControls({ isMobile, getLegendData }: { isMobile: boolean; getLegendData?: GetLegendData }) {
  return (
    <>
      <NavigationMapControl />
      <HomeMapControl />
      <MapHistoryMapControl getLegendData={getLegendData} />
      {/* Keyed: react-map-gl reads a control's position only when it mounts. */}
      <GeolocateControl
        key={isMobile ? 'phone' : 'desktop'}
        position={isMobile ? 'bottom-right' : 'top-left'}
        showUserLocation={isMobile}
        showAccuracyCircle={false}
        fitBoundsOptions={{ maxZoom: 18 }}
      />
      <Suspense fallback={null}>
        <MeasureMapControl />
      </Suspense>
      {!isMobile && (
        <>
          <ScaleMapControl />
          <Suspense fallback={null}>
            <ExportMapControl getLegendData={getLegendData} />
          </Suspense>
        </>
      )}
    </>
  )
}
