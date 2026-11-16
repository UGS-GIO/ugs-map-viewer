import { useCallback, useSyncExternalStore } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { appSharedStops, openStop } from '@/lib/map/app-history'

/** The shared stops being presented, if any: which one shows, and moving between them. */
export function usePresentation() {
  const present = useSearch({ from: '/_map', select: (s) => s.present })
  const { stops } = useSyncExternalStore(appSharedStops.subscribe, appSharedStops.getSnapshot)
  const navigate = useNavigate()
  // A stale `present` (stops cleared, or past the end) just shows the map
  const index = present !== undefined && present <= stops.length ? present - 1 : undefined

  // Each stop is a new step, so Back in the browser or on a mouse goes back a stop
  const go = useCallback((i: number) => { if (stops[i]) openStop(stops[i], i + 1) }, [stops])
  const exit = useCallback(
    () => navigate({ to: '.', search: (prev) => ({ ...prev, present: undefined, stops: undefined }), replace: true }),
    [navigate],
  )

  return { presenting: index !== undefined, index: index ?? 0, stops, go, exit }
}
