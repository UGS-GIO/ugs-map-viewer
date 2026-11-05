import type { RouterHistory } from '@tanstack/react-router'
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate'
import { editHref, NON_STEP_PARAMS, withSticky } from './map-history'
import { readJson, sessionStorageIfAllowed, writeJson } from './session-json'

export interface SharedStop {
  label: string
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
  open: (stop: SharedStop) => void
  markSeen: () => void
  clear: () => void
}

export const STOPS_PARAM = 'stops'

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
  return toBase64Url(gzipSync(strToU8(JSON.stringify(stops.map(({ label, href }) => [label, href]))), { mtime: 0 }))
}

export function decodeStops(text: string): SharedStop[] {
  const parsed: unknown = JSON.parse(strFromU8(gunzipSync(fromBase64Url(text))))
  if (!Array.isArray(parsed)) throw new Error('Shared stops are not a list')
  return parsed.flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].startsWith('/')
      ? [{ label: entry[0], href: entry[1] }]
      : [])
}

/** A link that opens on the first stop with the stops attached. */
export function buildStopsLink(origin: string, stops: SharedStop[]): string {
  const url = new URL(stops[0].href, origin)
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

  return {
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getSnapshot: () => snapshot,
    // Keep the recipient's own layout and preferences
    open: (stop) => history.push(withSticky(stop.href, history.location.search)),
    markSeen: () => { if (snapshot.unseen) set({ ...snapshot, unseen: false }) },
    clear: () => set({ stops: [], unseen: false }),
  }
}
