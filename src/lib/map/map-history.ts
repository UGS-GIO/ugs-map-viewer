import { createBrowserHistory, type RouterHistory } from '@tanstack/react-router'

// Layout, preferences and the active tool: not steps, and Back/Forward leaves them as they are
const STICKY_PARAMS = ['sidebar_collapsed', 'sidebar_width', 'coordinate_format', 'units', 'measure']
// The phone sheet's height and the presentation's place and stops aren't steps either, but follow the
// entry: the sheet drops with the results it showed, and Back in a presentation goes back a stop
export const NON_STEP_PARAMS = [...STICKY_PARAMS, 'sheet', 'present', 'stops']
// Writes closer together than this are one step: a wheel burst, a slider drag, typing, or one action's cascade
const QUIET_MS = 500
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel']

const mapState = (search: string) => {
  const params = new URLSearchParams(search)
  NON_STEP_PARAMS.forEach((key) => params.delete(key))
  params.sort()
  return params.toString()
}

/** An app path and search with its params changed by `edit` */
export function editHref(href: string, edit: (params: URLSearchParams) => void): string {
  const url = new URL(href, 'http://local')
  edit(url.searchParams)
  return `${url.pathname}${url.search}`
}

/** `href` with the layout and preference params as they are in `from` */
export function withSticky(href: string, from: string): string {
  const source = new URLSearchParams(from)
  return editHref(href, (params) => STICKY_PARAMS.forEach((key) => {
    const value = source.get(key)
    if (value === null) params.delete(key)
    else params.set(key, value)
  }))
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
      // The click that followed a link made this entry; the app's first writes on arrival aren't another
      userActed = false
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
