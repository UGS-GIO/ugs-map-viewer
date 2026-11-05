import { createMapHistory } from './map-history'
import { createMapSteps } from './map-steps'

export const appHistory = createMapHistory()
export const appSteps = createMapSteps(appHistory.history)
