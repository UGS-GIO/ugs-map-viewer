import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router'

// Panel layout and display preferences: changing them alone shouldn't add a back step
const UI_PARAMS = ['tab', 'sidebar_collapsed', 'sidebar_width', 'coordinate_format', 'units', 'sheet', 'results', 'detail', 'measure']
// Writes closer together than this are one step: a wheel burst, a slider drag, typing, or one action's cascade
const QUIET_MS = 500
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel']

const mapState = (search: string) => {
  const params = new URLSearchParams(search)
  UI_PARAMS.forEach((key) => params.delete(key))
  params.sort()
  return params.toString()
}

const indexOf = (history: RouterHistory) => history.location.state.__TSR_index

export interface MapHistory {
  history: RouterHistory
  canGoForward: () => boolean
}

/**
 * The app writes map state to the URL with `replace`, so the browser had one entry per visit and Back
 * left the app. This turns a user's change to map state into a new entry, so Back and Forward (browser,
 * mouse buttons, map buttons) step through map states. Writes no one made, like URL normalization, and
 * writes that only touch panel layout stay replaces.
 */
export function createMapHistory(history: RouterHistory = createBrowserHistory(), target: EventTarget = window): MapHistory {
  const replace = history.replace
  let userActed = false
  let lastWrite = 0
  // Browsers don't say whether there's a forward entry, so track the furthest one this page pushed
  let maxIndex = indexOf(history)

  const markInput = () => { userActed = true }
  INPUT_EVENTS.forEach((type) => target.addEventListener(type, markInput, { capture: true, passive: true }))

  history.subscribe(({ action }) => {
    if (action.type === 'PUSH') {
      maxIndex = indexOf(history)
    } else if (action.type !== 'REPLACE') {
      // The click or mouse button that went back isn't a change to record
      userActed = false
      lastWrite = Date.now()
    }
  })

  history.replace = (path, state, navigateOpts) => {
    const next = new URL(path, 'http://local')
    const { pathname, search } = history.location
    if (next.pathname !== pathname || mapState(next.search) === mapState(search)) return replace(path, state, navigateOpts)

    const now = Date.now()
    const quiet = now - lastWrite > QUIET_MS
    lastWrite = now
    if (!userActed || !quiet) return replace(path, state, navigateOpts)

    userActed = false
    history.push(path, state, navigateOpts)
  }

  return { history, canGoForward: () => indexOf(history) < maxIndex }
}
