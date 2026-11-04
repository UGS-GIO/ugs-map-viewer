import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router'

// Layout, preferences and the active tool: not steps, and Back/Forward leaves them as they are
const STICKY_PARAMS = ['sidebar_collapsed', 'sidebar_width', 'coordinate_format', 'units', 'measure']
// The phone sheet's height isn't a step either, but follows the entry so it drops with the results it showed
export const NON_STEP_PARAMS = [...STICKY_PARAMS, 'sheet']
// Writes closer together than this are one step: a wheel burst, a slider drag, typing, or one action's cascade
const QUIET_MS = 500
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel']

const mapState = (search: string) => {
  const params = new URLSearchParams(search)
  NON_STEP_PARAMS.forEach((key) => params.delete(key))
  params.sort()
  return params.toString()
}

/** `href` with the layout and preference params as they are in `from` */
export function withSticky(href: string, from: string): string {
  const url = new URL(href, 'http://local')
  const source = new URLSearchParams(from)
  STICKY_PARAMS.forEach((key) => {
    const value = source.get(key)
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  })
  return `${url.pathname}${url.search}`
}

const indexOf = (history: RouterHistory) => history.location.state.__TSR_index

export interface MapHistory {
  history: RouterHistory
  canGoForward: () => boolean
}

/**
 * Every URL write is a `replace`; this turns a user's change to map or panel state into a new entry,
 * so Back and Forward step through map states instead of leaving the app.
 */
export function createMapHistory(history: RouterHistory = createBrowserHistory(), target: EventTarget = window): MapHistory {
  const replace = history.replace
  let userActed = false
  let lastWrite = 0
  // Without the Navigation API, track the furthest entry this page pushed (lost on reload)
  let maxIndex = indexOf(history)

  const markInput = () => { userActed = true }
  INPUT_EVENTS.forEach((type) => target.addEventListener(type, markInput, { capture: true, passive: true }))

  // Every entry also holds the layout of its moment; Back shouldn't undo a sidebar collapse alongside a map step
  let previous = history.location
  const keepSticky = () => {
    const { pathname, search, href, state } = history.location
    if (pathname !== previous.pathname) return
    const kept = withSticky(href, previous.search)
    if (kept !== withSticky(href, search)) replace(kept, state)
  }

  history.subscribe(({ action }) => {
    if (action.type === 'PUSH') {
      maxIndex = indexOf(history)
    } else if (action.type !== 'REPLACE') {
      // The click or mouse button that went back isn't a change to record
      userActed = false
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
    if (!userActed || !quiet) return replace(path, state, navigateOpts)

    userActed = false
    history.push(path, state, navigateOpts)
  }

  return { history, canGoForward: () => window.navigation?.canGoForward ?? indexOf(history) < maxIndex }
}
