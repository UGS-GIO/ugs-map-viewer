import type { RouterHistory } from '@tanstack/react-router'
import { BASEMAP_STYLES } from '@/lib/basemaps'
import { NON_STEP_PARAMS } from './map-history'

export interface MapStep {
  /** Position in browser history; fixed for the step's life, unlike TanStack's key, which changes on every replace */
  index: number
  href: string
  summary: string
  label?: string
}

export interface MapStepsSnapshot {
  steps: MapStep[]
  current: number
}

export interface MapSteps {
  subscribe: (onChange: () => void) => () => void
  getSnapshot: () => MapStepsSnapshot
  setLabel: (index: number, label: string) => void
  go: (index: number) => void
}

const CAMERA_PARAMS = ['lat', 'lon', 'zoom', 'pitch', 'bearing']
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace(/[-_]/g, ' ')

/** A short description of what changed from one step to the next, for steps with no label. */
export function describeStep(previousHref: string | undefined, href: string): string {
  if (previousHref === undefined) return 'Start'
  const before = new URL(previousHref, 'http://local')
  const after = new URL(href, 'http://local')
  if (before.pathname !== after.pathname) return `Opened ${titleCase(after.pathname.replace(/^\//, '') || 'home')}`

  const was = before.searchParams
  const now = after.searchParams
  const changed = (key: string) => was.get(key) !== now.get(key)
  const has = (key: string) => now.get(key) !== null
  const phrases: string[] = []

  if (changed('click_bbox')) phrases.push(has('click_bbox') ? 'Selected features' : 'Cleared selection')
  if (changed('area')) phrases.push(has('area') ? 'Drew filter area' : 'Cleared filter area')
  if (changed('box_bbox')) phrases.push(has('box_bbox') ? 'Box selected' : 'Cleared box select')
  if (changed('tab') && has('tab')) phrases.push(`${titleCase(now.get('tab') ?? '')} panel`)
  if (changed('results') || changed('detail')) phrases.push('Changed panel view')
  if (changed('layers') || changed('visibility')) phrases.push('Changed layers')
  if (changed('opacities')) phrases.push('Changed opacity')
  if (changed('filters')) phrases.push('Changed filters')
  if (changed('layer_styles') || changed('vector_symbology')) phrases.push('Changed styling')
  if (changed('basemap')) {
    const basemap = BASEMAP_STYLES.find((b) => b.id === now.get('basemap'))
    phrases.push(`Basemap: ${basemap?.title ?? 'default'}`)
  }
  if (changed('terrain')) phrases.push(now.get('terrain') === 'false' ? '2D' : '3D')
  if (changed('exaggeration')) phrases.push('Changed 3D exaggeration')
  if (changed('view')) phrases.push(`${titleCase(now.get('view') ?? 'map')} view`)

  // The map writes its camera back after every move, so ignore rounding noise
  const differs = (key: string, tolerance: number) => Math.abs(Number(was.get(key) ?? 0) - Number(now.get(key) ?? 0)) > tolerance
  const zoomBefore = Number(was.get('zoom'))
  const zoomAfter = Number(now.get('zoom'))
  // Zooming around the cursor also shifts the center, so a zoom reads as a zoom
  if (differs('zoom', 0.01)) phrases.push(zoomAfter > zoomBefore ? 'Zoomed in' : 'Zoomed out')
  else if (differs('lat', 1e-5) || differs('lon', 1e-5)) phrases.push('Moved map')
  else if (differs('pitch', 0.5) || differs('bearing', 0.5)) phrases.push('Tilted or rotated')

  const other = [...new Set([...was.keys(), ...now.keys()])]
    .filter((key) => changed(key) && !CAMERA_PARAMS.includes(key) && !NON_STEP_PARAMS.includes(key))
  if (phrases.length === 0 && other.length > 0) phrases.push('Changed map settings')
  return phrases.slice(0, 2).join(', ') || 'Map view'
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: steps still work for this page, just not across a reload
  }
}

const HREFS_KEY = 'map-history-steps'
const LABELS_KEY = 'map-history-labels'

/**
 * The steps in this tab's history, so they can be listed, jumped between and labelled. Kept in
 * sessionStorage alongside the browser's own history, which outlives a reload but can't be read back.
 */
// A typed URL or a followed link starts a new document whose steps restart at index 0, so the stored
// log describes entries that are gone. A reload or Back/Forward into the app keeps it.
function isFreshNavigation(): boolean {
  const [entry] = typeof performance === 'undefined' ? [] : performance.getEntriesByType('navigation')
  return entry instanceof PerformanceNavigationTiming && entry.type === 'navigate'
}

export function createMapSteps(history: RouterHistory, storage: Storage = sessionStorage, fresh = isFreshNavigation()): MapSteps {
  if (fresh) {
    storage.removeItem(HREFS_KEY)
    storage.removeItem(LABELS_KEY)
  }
  const indexOf = () => history.location.state.__TSR_index
  // JSON turns gaps (steps from before this page's first visit) into null
  const hrefs: (string | null)[] = readJson(storage, HREFS_KEY, [])
  const labels: Record<number, string> = readJson(storage, LABELS_KEY, {})
  const listeners = new Set<() => void>()
  let snapshot: MapStepsSnapshot = { steps: [], current: 0 }

  const rebuild = () => {
    snapshot = {
      current: indexOf(),
      steps: hrefs.flatMap((href, index) =>
        href ? [{ index, href, summary: describeStep(hrefs[index - 1] ?? undefined, href), label: labels[index] }] : []),
    }
    listeners.forEach((listener) => listener())
  }

  const record = (pushed: boolean) => {
    const index = indexOf()
    if (pushed) {
      // A new step drops the ones after it, and their labels with them
      hrefs.length = index
      Object.keys(labels).map(Number).filter((i) => i >= index).forEach((i) => delete labels[i])
      writeJson(storage, LABELS_KEY, labels)
    }
    hrefs[index] = history.location.href
    writeJson(storage, HREFS_KEY, hrefs)
    rebuild()
  }

  record(false)
  history.subscribe(({ action }) => {
    if (action.type === 'PUSH') record(true)
    else if (action.type === 'REPLACE') record(false)
    else rebuild()
  })

  return {
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getSnapshot: () => snapshot,
    setLabel: (index, label) => {
      const trimmed = label.trim()
      if (trimmed) labels[index] = trimmed
      else delete labels[index]
      writeJson(storage, LABELS_KEY, labels)
      rebuild()
    },
    go: (index) => {
      const delta = index - indexOf()
      if (delta !== 0) history.go(delta)
    },
  }
}
