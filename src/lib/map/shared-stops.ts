import type { RouterHistory } from '@tanstack/react-router'
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import { editHref, NON_STEP_PARAMS, withSticky } from './map-history'
import { readJson, sessionStorageIfAllowed, writeJson } from './session-json'
import { HALF } from '@/components/maps/phone-sheet/sheet-model'

export interface SharedStop {
  label: string
  /** What to say about this stop; shown under the label when presenting */
  note?: string
  /** Path and search of the map state, without layout or preferences */
  href: string
}

export interface SharedStopsSnapshot {
  stops: SharedStop[]
  /** Arrived from a link and not yet looked at, so the list opens itself */
  unseen: boolean
}

export interface SharedStops {
  subscribe: (onChange: () => void) => () => void
  getSnapshot: () => SharedStopsSnapshot
  /** Opens a stop as a new step; `present` (from 1) shows it in the presentation */
  open: (stop: SharedStop, present?: number) => void
  /** Lists these stops and opens the first in the presentation */
  present: (stops: SharedStop[]) => void
  markSeen: () => void
  clear: () => void
}

export const STOPS_PARAM = 'stops'
export const PRESENT_PARAM = 'present'

/** A, B, C… then AA, AB… so stops past Z keep distinct letters */
export const stopLetter = (i: number): string =>
  (i >= 26 ? stopLetter(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))
const STORAGE_KEY = 'map-shared-stops'

/** A step's URL as a shared stop: the recipient keeps their own layout and preferences. */
export function toStopHref(href: string): string {
  return editHref(href, (params) => [...NON_STEP_PARAMS, STOPS_PARAM].forEach((key) => params.delete(key)))
}

// fflate's latin1 mode maps each byte to one character, which is what btoa and atob take
const toBase64Url = (bytes: Uint8Array) => btoa(strFromU8(bytes, true)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (text: string) => strToU8(atob(text.replace(/-/g, '+').replace(/_/g, '/')), true)

/** Stops gzipped into one URL-safe string, so a handful of map states fit in a link. */
export function encodeStops(stops: SharedStop[]): string {
  // mtime 0, so the same stops always make the same link
  return toBase64Url(gzipSync(strToU8(JSON.stringify(stops.map(({ label, href, note }) => (note ? [label, href, note] : [label, href])))), { mtime: 0 }))
}

export function decodeStops(text: string): SharedStop[] {
  const parsed: unknown = JSON.parse(strFromU8(gunzipSync(fromBase64Url(text))))
  if (!Array.isArray(parsed)) throw new Error('Shared stops are not a list')
  return parsed.flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].startsWith('/')
      ? [{ label: entry[0], href: entry[1], ...(typeof entry[2] === 'string' && entry[2] ? { note: entry[2] } : {}) }]
      : [])
}

const withPresent = (href: string, present: number | undefined) => {
  if (present === undefined) return href
  const url = new URL(href, 'http://local')
  url.searchParams.set(PRESENT_PARAM, String(present))
  // On phones the stop's note and features are in the sheet, so it opens raised; desktop ignores it
  url.searchParams.set('sheet', HALF)
  return `${url.pathname}${url.search}`
}

/** A link that presents the stops, from the first, with the stops attached. */
export function buildStopsLink(origin: string, stops: SharedStop[]): string {
  const url = new URL(withPresent(stops[0].href, 1), origin)
  url.searchParams.set(STOPS_PARAM, encodeStops(stops))
  return url.toString()
}

/**
 * Stops someone shared, read from a link's `stops` param and kept for this tab. Opening a stop is a
 * normal navigation, so Back and Forward still step through what the recipient did.
 */
export function createSharedStops(history: RouterHistory, storage = sessionStorageIfAllowed()): SharedStops {
  const listeners = new Set<() => void>()
  let snapshot: SharedStopsSnapshot = { stops: readJson(storage, STORAGE_KEY, []), unseen: false }

  const set = (next: SharedStopsSnapshot) => {
    snapshot = next
    writeJson(storage, STORAGE_KEY, next.stops)
    listeners.forEach((listener) => listener())
  }

  const encoded = new URLSearchParams(history.location.search).get(STOPS_PARAM)
  if (encoded) {
    // Drop the param either way, so a reload or a copied URL doesn't re-import it
    history.replace(editHref(history.location.href, (params) => params.delete(STOPS_PARAM)), history.location.state)
    try {
      const stops = decodeStops(encoded)
      if (stops.length > 0) set({ stops, unseen: true })
    } catch (error) {
      console.error('Could not read the shared map stops:', error)
    }
  }

  const open = (stop: SharedStop, present?: number) => history.push(withPresent(withSticky(stop.href, history.location.search), present))

  return {
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getSnapshot: () => snapshot,
    // Keep the recipient's own layout and preferences
    open,
    present: (stops) => {
      set({ stops, unseen: false })
      open(stops[0], 1)
    },
    markSeen: () => { if (snapshot.unseen) set({ ...snapshot, unseen: false }) },
    clear: () => set({ stops: [], unseen: false }),
  }
}
