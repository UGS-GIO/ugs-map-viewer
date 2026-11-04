import type { RouterHistory } from '@tanstack/react-router'
import { BASEMAP_STYLES } from '@/lib/basemaps'
import { NON_STEP_PARAMS } from './map-history'
import { cameraChanges, cameraOf } from './url-camera'
import { readJson, writeJson } from './session-json'

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
  /** Resolves once the browser lands on the step, or rejects if it never does */
  go: (index: number) => Promise<void>
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

  const from = cameraOf(before.search)
  const to = cameraOf(after.search)
  if (from && to) {
    const { moved, zoomed, turned } = cameraChanges(from, to)
    // Zooming around the cursor also shifts the center, so a zoom reads as a zoom
    if (zoomed) phrases.push(to.zoom > from.zoom ? 'Zoomed in' : 'Zoomed out')
    else if (moved) phrases.push('Moved map')
    else if (turned) phrases.push('Tilted or rotated')
  }

  const other = [...new Set([...was.keys(), ...now.keys()])]
    .filter((key) => changed(key) && !CAMERA_PARAMS.includes(key) && !NON_STEP_PARAMS.includes(key))
  if (phrases.length === 0 && other.length > 0) phrases.push('Changed map settings')
  return phrases.slice(0, 2).join(', ') || 'Map view'
}

const HREFS_KEY = 'map-history-steps'
const LABELS_KEY = 'map-history-labels'

// A typed URL or a followed link starts a new document whose steps restart at index 0, so the stored
// log describes entries that are gone. A reload or Back/Forward into the app keeps it.
function isFreshNavigation(): boolean {
  const [entry] = typeof performance === 'undefined' ? [] : performance.getEntriesByType('navigation')
  return entry instanceof PerformanceNavigationTiming && entry.type === 'navigate'
}

/** This tab's steps, logged in sessionStorage since the browser's own history can't be read back. */
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
      // Only map views: the landing page or a report in the same tab isn't a step to jump to or print
      steps: hrefs.flatMap((href, index) =>
        href && cameraOf(new URL(href, 'http://local').search)
          ? [{ index, href, summary: describeStep(hrefs[index - 1] ?? undefined, href), label: labels[index] }]
          : []),
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
    go: (index) => new Promise((resolve, reject) => {
      if (indexOf() === index) return resolve()
      const timeout = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Step ${index + 1} is no longer in this tab's history`))
      }, 5000)
      const unsubscribe = history.subscribe(() => {
        if (indexOf() !== index) return
        clearTimeout(timeout)
        unsubscribe()
        resolve()
      })
      history.go(index - indexOf())
    }),
  }
}
