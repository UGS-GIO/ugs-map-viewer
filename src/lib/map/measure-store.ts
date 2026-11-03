import type { Map as MapLibreMap } from 'maplibre-gl'
import type { MeasureControl } from './measure'

// Kept apart from measure.ts so the URL schema and sidebar don't pull in Terra Draw
export const MEASURE_MODES = ['linestring', 'polygon', 'point'] as const
export type MeasureMode = (typeof MEASURE_MODES)[number]

export function isMeasureMode(value: unknown): value is MeasureMode {
  return MEASURE_MODES.some((m) => m === value)
}

export const UNIT_SYSTEMS = ['us', 'metric'] as const
export type UnitSystem = (typeof UNIT_SYSTEMS)[number]

export function isUnitSystem(value: unknown): value is UnitSystem {
  return UNIT_SYSTEMS.some((u) => u === value)
}

export interface Measurement {
  id: string | number
  mode: MeasureMode
  /** Line length in meters */
  lengthM?: number
  /** Each leg of a line, in meters */
  segmentsM?: number[]
  /** Polygon area in square meters */
  areaM2?: number
  perimeterM?: number
  /** A finished polygon's outer ring, for its terrain stats */
  ring?: [number, number][]
  /** Point elevation in meters once its DEM tile loads; null if the lookup failed */
  elevationM?: number | null
  coordinates?: [number, number]
  /** A finished line's vertices, for its elevation profile */
  path?: [number, number][]
}

export interface Quantity {
  value: number
  unit: string
}

const FT_PER_M = 3.28084
const FT_PER_MI = 5280
const M2_PER_ACRE = 4046.8564224
const ACRES_PER_MI2 = 640
const M2_PER_HA = 10_000
const HA_PER_KM2 = 100

/** US: feet under 1,000 ft, else miles. Metric: meters under 1,000 m, else kilometers. */
export function formatLength(meters: number, units: UnitSystem = 'us'): Quantity {
  if (units === 'metric') {
    return meters < 1000 ? { value: Math.round(meters), unit: 'm' } : { value: Number((meters / 1000).toFixed(2)), unit: 'km' }
  }
  const ft = meters * FT_PER_M
  return ft < 1000 ? { value: Math.round(ft), unit: 'ft' } : { value: Number((ft / FT_PER_MI).toFixed(2)), unit: 'mi' }
}

/** US: acres under a square mile, else square miles. Metric: hectares under 1 km², else km². */
export function formatArea(squareMeters: number, units: UnitSystem = 'us'): Quantity {
  if (units === 'metric') {
    const ha = squareMeters / M2_PER_HA
    return ha < HA_PER_KM2 ? { value: Number(ha.toFixed(2)), unit: 'ha' } : { value: Number((ha / HA_PER_KM2).toFixed(2)), unit: 'km²' }
  }
  const acres = squareMeters / M2_PER_ACRE
  return acres < ACRES_PER_MI2
    ? { value: Number(acres.toFixed(2)), unit: 'acres' }
    : { value: Number((acres / ACRES_PER_MI2).toFixed(2)), unit: 'mi²' }
}

/** Elevation in feet (US) or meters, rounded. */
export function formatElevation(meters: number, units: UnitSystem = 'us'): Quantity {
  return { value: Math.round(units === 'metric' ? meters : meters * FT_PER_M), unit: units === 'metric' ? 'm' : 'ft' }
}

/** A measurement's main value: length, area or point elevation. */
export function measurementQuantity(m: Measurement, units: UnitSystem): Quantity | undefined {
  if (m.lengthM !== undefined) return formatLength(m.lengthM, units)
  if (m.areaM2 !== undefined) return formatArea(m.areaM2, units)
  return typeof m.elevationM === 'number' ? formatElevation(m.elevationM, units) : undefined
}

export const formatQuantity = ({ value, unit }: Quantity) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`

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
