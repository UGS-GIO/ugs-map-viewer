import type { RouterHistory } from '@tanstack/react-router'
import { NON_STEP_PARAMS, STICKY_PARAMS } from './map-history'

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
const STORAGE_KEY = 'map-shared-stops'

/** A step's URL as a shared stop: the recipient keeps their own layout and preferences. */
export function toStopHref(href: string): string {
  const url = new URL(href, 'http://local')
  NON_STEP_PARAMS.forEach((key) => url.searchParams.delete(key))
  url.searchParams.delete(STOPS_PARAM)
  return `${url.pathname}${url.search}`
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter()
  // Not awaited: the write waits for the reader below to drain it
  void writer.write(bytes).then(() => writer.close()).catch(() => {})
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** Stops gzipped into one URL-safe string, so a handful of map states fit in a link. */
export async function encodeStops(stops: SharedStop[]): Promise<string> {
  const json = JSON.stringify(stops.map(({ label, href }) => [label, href]))
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')))
}

export async function decodeStops(text: string): Promise<SharedStop[]> {
  const json = new TextDecoder().decode(await pipe(fromBase64Url(text), new DecompressionStream('gzip')))
  const parsed: unknown = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Shared stops are not a list')
  return parsed.flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].startsWith('/')
      ? [{ label: entry[0], href: entry[1] }]
      : [])
}

/** A link that opens on the first stop with the stops attached. */
export async function buildStopsLink(origin: string, stops: SharedStop[]): Promise<string> {
  const url = new URL(stops[0].href, origin)
  url.searchParams.set(STOPS_PARAM, await encodeStops(stops))
  return url.toString()
}

/**
 * Stops someone shared, read from a link's `stops` param and kept for this tab. Opening a stop is a
 * normal navigation, so Back and Forward still step through what the recipient did.
 */
export function createSharedStops(history: RouterHistory, storage: Storage = sessionStorage): SharedStops {
  const listeners = new Set<() => void>()
  let snapshot: SharedStopsSnapshot = { stops: [], unseen: false }
  try {
    snapshot = { stops: JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]'), unseen: false }
  } catch {
    // None stored
  }

  const set = (next: SharedStopsSnapshot) => {
    snapshot = next
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next.stops))
    } catch {
      // Private mode: they last until reload
    }
    listeners.forEach((listener) => listener())
  }

  const encoded = new URLSearchParams(history.location.search).get(STOPS_PARAM)
  if (encoded) {
    // Drop the param either way, so a reload or a copied URL doesn't re-import it
    const url = new URL(history.location.href, 'http://local')
    url.searchParams.delete(STOPS_PARAM)
    history.replace(`${url.pathname}${url.search}`, history.location.state)
    decodeStops(encoded)
      .then((stops) => { if (stops.length > 0) set({ stops, unseen: true }) })
      .catch((error) => console.error('Could not read the shared map stops:', error))
  }

  return {
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getSnapshot: () => snapshot,
    open: (stop) => {
      // Keep the recipient's own layout and preferences
      const url = new URL(stop.href, 'http://local')
      const current = new URLSearchParams(history.location.search)
      STICKY_PARAMS.forEach((key) => {
        const value = current.get(key)
        if (value !== null) url.searchParams.set(key, value)
      })
      history.push(`${url.pathname}${url.search}`)
    },
    markSeen: () => { if (snapshot.unseen) set({ ...snapshot, unseen: false }) },
    clear: () => set({ stops: [], unseen: false }),
  }
}
