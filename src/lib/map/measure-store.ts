import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MeasureControl } from './measure'

// Kept apart from measure.ts so the URL schema and sidebar don't pull in Terra Draw
export const MEASURE_MODES = ['linestring', 'polygon', 'point'] as const
export type MeasureMode = (typeof MEASURE_MODES)[number]

export function isMeasureMode(value: unknown): value is MeasureMode {
  return MEASURE_MODES.some((m) => m === value)
}

export interface Measurement {
  id: string | number
  mode: MeasureMode
  /** Line length or polygon area, already in `unit` */
  value?: number
  unit?: string
  /** Point elevation in feet, once its DEM tile loads */
  elevationFt?: number
  coordinates?: [number, number]
  /** A finished line's vertices, for its elevation profile */
  path?: [number, number][]
}

const FT_PER_M = 3.28084
const M2_PER_ACRE = 4046.8564224
const ACRES_PER_MI2 = 640

/** Feet under 1,000 ft, else miles. */
export function formatLength(meters: number): { value: number; unit: string } {
  const ft = meters * FT_PER_M
  return ft < 1000 ? { value: Math.round(ft), unit: 'ft' } : { value: Number((ft / 5280).toFixed(2)), unit: 'mi' }
}

/** Acres under a square mile, else square miles. */
export function formatArea(squareMeters: number): { value: number; unit: string } {
  const acres = squareMeters / M2_PER_ACRE
  return acres < ACRES_PER_MI2
    ? { value: Number(acres.toFixed(2)), unit: 'acres' }
    : { value: Number((acres / ACRES_PER_MI2).toFixed(2)), unit: 'mi²' }
}

export const metersToFeet = (m: number) => m * FT_PER_M

// One measure control per map, so the sidebar panel can reach the one the map mounted
const controls = new WeakMap<MapLibreMap, MeasureControl>()
const listeners = new Set<() => void>()

export function registerMeasureControl(map: MapLibreMap, control: MeasureControl | undefined) {
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
