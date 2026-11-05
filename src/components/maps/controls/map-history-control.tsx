import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCanGoBack, useRouterState } from '@tanstack/react-router'
import { useControl, useMap } from 'react-map-gl/maplibre'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type * as maplibregl from 'maplibre-gl'
import type { MapHistory } from '@/lib/map/map-history'
import { cameraChanges, cameraOf, type Camera } from '@/lib/map/url-camera'
import { PortalControl } from './portal-control'

const cameraOfMap = (map: maplibregl.Map): Camera => {
  const { lng, lat } = map.getCenter()
  return { center: [lng, lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }
}

/** The map reads the URL's camera only when it mounts, so move it when history lands somewhere new. */
function useCameraFollowsHistory({ history, isPromoting, moveStarted }: MapHistory) {
  const { current: mapRef } = useMap()
  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return
    // easeTo keeps the pixel anchor it started with, and a results panel opening or closing with the
    // step resizes the map mid-ease, landing it half the width change off. Restart from each new size.
    let stopFollowingResize: (() => void) | undefined
    const easeTo = (camera: Camera) => {
      stopFollowingResize?.()
      const restart = () => map.easeTo(camera)
      const stop = () => {
        map.off('resize', restart)
        map.off('idle', stop)
      }
      map.on('resize', restart)
      map.on('idle', stop)
      stopFollowingResize = stop
      map.easeTo(camera)
    }
    let moveEnded = () => {}
    const onMoveStart = () => { moveEnded = moveStarted() }
    const onMoveEnd = () => moveEnded()
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    const unsubscribe = history.subscribe(({ action, location }) => {
      const camera = cameraOf(location.search)
      if (!camera) return
      const traversed = action.type !== 'PUSH' && action.type !== 'REPLACE'
      // A push the map didn't write itself, like a shared stop. Never mid-gesture or for the map's own
      // write, whose camera can lag the map by the URL's debounce.
      const pushedElsewhere = action.type === 'PUSH' && !isPromoting() && !map.isMoving() && Object.values(cameraChanges(cameraOfMap(map), camera)).some(Boolean)
      if (traversed || pushedElsewhere) easeTo(camera)
    })
    return () => {
      stopFollowingResize?.()
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      unsubscribe()
    }
  }, [mapRef, history, isPromoting, moveStarted])
}

/** Back and Forward through the map's browser history, plus whatever else belongs in the group. */
export function MapHistoryControl({ nav, children }: { nav: MapHistory; children?: ReactNode }) {
  const control = useControl(() => new PortalControl(), { position: 'top-left' })
  const canGoBack = useCanGoBack()
  // Re-read on every router state change, which follows the browser writing the entry
  const canGoForward = useRouterState({ select: () => nav.canGoForward() })
  useCameraFollowsHistory(nav)

  return createPortal(
    <>
      <button type='button' className='maplibregl-ctrl-icon' title='Back to previous map view' aria-label='Back to previous map view' disabled={!canGoBack} onClick={() => nav.history.back()}>
        <ArrowLeft size={20} strokeWidth={2} aria-hidden />
      </button>
      <button type='button' className='maplibregl-ctrl-icon' title='Forward to next map view' aria-label='Forward to next map view' disabled={!canGoForward} onClick={() => nav.history.forward()}>
        <ArrowRight size={20} strokeWidth={2} aria-hidden />
      </button>
      {children}
    </>,
    control.getContainer(),
  )
}
