import { createMapHistory } from './map-history'
import { createMapSteps, type MapSteps } from './map-steps'
import { createSharedStops, STOPS_PARAM, type SharedStop, type SharedStops } from './shared-stops'

// Read before the router writes the schema's default camera into the URL, and before the stops param is dropped
const launchParams = new URLSearchParams(window.location.search)
export const linkHasCamera = launchParams.has('lat')
export const linkHasSharedStops = launchParams.has(STOPS_PARAM)

export const appHistory = createMapHistory()
// Before the steps log, so it reads the URL after a shared link's stops param is dropped
export const appSharedStops = createSharedStops(appHistory.history)
export const appSteps = createMapSteps(appHistory.history)

const labelCurrent = (steps: MapSteps, label: string) => steps.setLabel(steps.getSnapshot().current, label)

// A shared link lands on its first stop, so that step carries the stop's label too
const [firstStop] = appSharedStops.getSnapshot().stops
if (linkHasSharedStops && firstStop) labelCurrent(appSteps, firstStop.label)

/** Opens a shared stop as a new step labeled as the stop; `present` (from 1) shows it in the presentation. */
export function openStop(stop: SharedStop, present?: number, shared: SharedStops = appSharedStops, steps: MapSteps = appSteps) {
  shared.open(stop, present)
  labelCurrent(steps, stop.label)
}

/** Presents these stops from the first, as a shared link does. */
export function presentStops(stops: SharedStop[], shared: SharedStops = appSharedStops, steps: MapSteps = appSteps) {
  if (stops.length === 0) return
  shared.present(stops)
  labelCurrent(steps, stops[0].label)
}
