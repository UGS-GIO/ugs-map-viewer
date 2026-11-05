import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router'

// Layout, preferences and the active tool: not steps, and Back/Forward leaves them as they are
const STICKY_PARAMS = ['sidebar_collapsed', 'sidebar_width', 'coordinate_format', 'units', 'measure']
// The phone sheet's height isn't a step either, but follows the entry so it drops with the results it showed
const NON_STEP_PARAMS = [...STICKY_PARAMS, 'sheet']
// Writes closer together than this are one step: a wheel burst, a slider drag, typing, or one action's cascade
const QUIET_MS = 500
// A write this long after the last input isn't that input's doing, e.g. a slow query's derived bbox
const INPUT_WINDOW_MS = 1000
// pointerup ends a drag, so the camera write after a long pan still follows an input
const INPUT_EVENTS = ['pointerdown', 'pointerup', 'keydown', 'wheel']

const mapState = (search: string) => {
  const params = new URLSearchParams(search)
  NON_STEP_PARAMS.forEach((key) => params.delete(key))
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
 * mouse buttons, map buttons) step through map and panel states. Writes no one made, like URL
 * normalization, and writes that only touch layout or preferences stay replaces.
 */
export function createMapHistory(history: RouterHistory = createBrowserHistory(), target: EventTarget = window): MapHistory {
  const replace = history.replace
  let lastInput = -Infinity
  let lastWrite = 0
  // Without the Navigation API, track the furthest entry this page pushed (lost on reload)
  let maxIndex = indexOf(history)

  const markInput = () => { lastInput = Date.now() }
  INPUT_EVENTS.forEach((type) => target.addEventListener(type, markInput, { capture: true, passive: true }))

  // Every entry also holds the layout of its moment; Back shouldn't undo a sidebar collapse alongside a map step
  let previous = history.location
  const keepSticky = () => {
    const { pathname, search, state } = history.location
    if (pathname !== previous.pathname) return
    const params = new URLSearchParams(search)
    const before = new URLSearchParams(previous.search)
    STICKY_PARAMS.forEach((key) => {
      const value = before.get(key)
      if (value === null) params.delete(key)
      else params.set(key, value)
    })
    if (params.toString() !== new URLSearchParams(search).toString()) replace(`${pathname}?${params}`, state)
  }

  history.subscribe(({ action }) => {
    if (action.type === 'PUSH') {
      maxIndex = indexOf(history)
    } else if (action.type !== 'REPLACE') {
      // The click or mouse button that went back isn't a change to record
      lastInput = -Infinity
      lastWrite = Date.now()
      keepSticky()
    }
    previous = history.location
  })

  history.replace = (path, state, navigateOpts) => {
    const next = new URL(path, 'http://local')
    const { pathname, search } = history.location
    if (next.pathname !== pathname || mapState(next.search) === mapState(search)) return replace(path, state, navigateOpts)

    const now = Date.now()
    const quiet = now - lastWrite > QUIET_MS
    lastWrite = now
    if (now - lastInput > INPUT_WINDOW_MS || !quiet) return replace(path, state, navigateOpts)

    lastInput = -Infinity
    history.push(path, state, navigateOpts)
  }

  return { history, canGoForward: () => window.navigation?.canGoForward ?? indexOf(history) < maxIndex }
}
