import { createMapHistory } from './map-history'
import { createMapSteps } from './map-steps'
import { createSharedStops, STOPS_PARAM } from './shared-stops'

// Read before the router writes the schema's default camera into the URL, and before the stops param is dropped
const launchParams = new URLSearchParams(window.location.search)
export const linkHasCamera = launchParams.has('lat')
export const linkHasSharedStops = launchParams.has(STOPS_PARAM)

export const appHistory = createMapHistory()
// Before the steps log, so it reads the URL after a shared link's stops param is dropped
export const appSharedStops = createSharedStops(appHistory.history)
export const appSteps = createMapSteps(appHistory.history)
