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

export interface LengthUnit {
  unit: string
  /** Meters in one of `unit` */
  m: number
  /** ft and m read as whole numbers; mi and km to two places */
  small: boolean
}

/** The unit a length reads in. US: feet under 1,000 ft, else miles. Metric: meters under 1,000 m, else km. */
export function lengthUnit(meters: number, units: UnitSystem = 'us'): LengthUnit {
  if (units === 'metric') return meters < 1000 ? { unit: 'm', m: 1, small: true } : { unit: 'km', m: 1000, small: false }
  return meters * FT_PER_M < 1000 ? { unit: 'ft', m: 1 / FT_PER_M, small: true } : { unit: 'mi', m: FT_PER_MI / FT_PER_M, small: false }
}

/** Elevations read in feet (US) or meters. */
export const elevationUnit = (units: UnitSystem = 'us'): LengthUnit =>
  units === 'metric' ? { unit: 'm', m: 1, small: true } : { unit: 'ft', m: 1 / FT_PER_M, small: true }

const inUnit = (meters: number, u: LengthUnit): Quantity => {
  const v = meters / u.m
  return { value: u.small ? Math.round(v) : Number(v.toFixed(2)), unit: u.unit }
}

export const formatLength = (meters: number, units: UnitSystem = 'us') => inUnit(meters, lengthUnit(meters, units))

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
export const formatElevation = (meters: number, units: UnitSystem = 'us') => inUnit(meters, elevationUnit(units))

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
