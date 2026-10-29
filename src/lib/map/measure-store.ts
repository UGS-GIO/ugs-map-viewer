import type { Map as MapLibreMap } from 'maplibre-gl'
import type { HeadlessMeasureControl } from './measure'

// Kept apart from measure.ts so the URL schema and sidebar don't pull in the draw library
export const MEASURE_MODES = ['linestring', 'polygon', 'point'] as const
export type MeasureMode = (typeof MEASURE_MODES)[number]

export interface Measurement {
  id: string | number
  mode: MeasureMode
  /** Line length or polygon area, already in `unit` */
  value?: number
  unit?: string
  elevation?: number
  elevationUnit?: string
  coordinates?: [number, number]
}

// One measure control per map, so the sidebar panel can reach the one the map mounted
const controls = new WeakMap<MapLibreMap, HeadlessMeasureControl>()
const listeners = new Set<() => void>()

export function registerMeasureControl(map: MapLibreMap, control: HeadlessMeasureControl | undefined) {
  if (control) controls.set(map, control)
  else controls.delete(map)
  listeners.forEach((l) => l())
}

export function getMeasureControl(map: MapLibreMap | undefined) {
  return map ? controls.get(map) : undefined
}

export function subscribeMeasureControls(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
