import type { GeoJSONStoreFeatures } from 'terra-draw'
import { area } from '@turf/area'
import { length } from '@turf/length'
import { lineString } from '@turf/helpers'
import polylabel from 'polylabel'
import { formatQuantity, isMeasureMode, measurementQuantity, type Measurement, type UnitSystem } from './measure-store'

// Pure pieces of the measure control: Terra Draw features in, measurements and map labels out

/** A point's DEM lookup: meters, still loading, failed, or not started. */
export type ElevationState = number | 'pending' | 'failed' | undefined

const toPair = ([x, y]: number[]): [number, number] => [x, y]

/** Measurement for a Terra Draw feature, or undefined for the helper points drawing modes add. */
export function featureMeasurement(f: GeoJSONStoreFeatures, elevation: ElevationState): Measurement | undefined {
  const mode = f.properties.mode
  const id = f.id
  if (!isMeasureMode(mode) || id === undefined) return undefined
  const g = f.geometry
  const finished = !f.properties.currentlyDrawing
  if (g.type === 'LineString') {
    const segmentsM = g.coordinates.slice(1).map((b, i) => length(lineString([g.coordinates[i], b]), { units: 'meters' }))
    return { id, mode, path: finished ? g.coordinates.map(toPair) : undefined, lengthM: segmentsM.reduce((a, b) => a + b, 0), segmentsM }
  }
  if (g.type === 'Polygon') {
    return { id, mode, ring: finished ? g.coordinates[0].map(toPair) : undefined, areaM2: area(f), perimeterM: length(f, { units: 'meters' }) }
  }
  // Line and polygon modes add helper points (closing, snapping) while drawing
  if (mode !== 'point') return undefined
  const elevationM = typeof elevation === 'number' ? elevation : elevation === 'failed' ? null : undefined
  return { id, mode, coordinates: toPair(g.coordinates), elevationM }
}

/** Features that can go back into a new Terra Draw: finished measurements, not a half-drawn one or its helpers. */
export function restorableFeatures(snapshot: GeoJSONStoreFeatures[]) {
  return snapshot.filter((f) => {
    const mode = f.properties.mode
    return isMeasureMode(mode) && !f.properties.currentlyDrawing && (f.geometry.type !== 'Point' || mode === 'point')
  })
}

/** Our layer ids, in order, when any other layer sits above the lowest of them; else none. */
export function layersToRaise(order: string[], prefix: string) {
  const first = order.findIndex((id) => id.startsWith(prefix))
  if (first < 0 || !order.slice(first).some((id) => !id.startsWith(prefix))) return []
  return order.filter((id) => id.startsWith(prefix))
}

/** Where a feature's value label sits: a line's last vertex, a polygon's visual center, the point. */
export function labelPoint(f: GeoJSONStoreFeatures): [number, number] | undefined {
  const g = f.geometry
  if (g.type === 'Point') return toPair(g.coordinates)
  if (g.type === 'LineString') return toPair(g.coordinates[g.coordinates.length - 1])
  if (g.type === 'Polygon') return toPair(polylabel(g.coordinates.map((ring) => ring.map(toPair)), 0.0001))
  return undefined
}

export function labelText(m: Measurement, units: UnitSystem) {
  const q = measurementQuantity(m, units)
  return q ? formatQuantity(q) : ''
}
