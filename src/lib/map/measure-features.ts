import type { GeoJSONStoreFeatures } from 'terra-draw'
import { area } from '@turf/area'
import { length } from '@turf/length'
import polylabel from 'polylabel'
import { segmentLengthsM } from './dem-elevation'
import { formatQuantity, isMeasureMode, measurementQuantity, type Measurement, type UnitSystem } from './measure-store'

// Pure pieces of the measure control: Terra Draw features in, measurements and map labels out

const toPair = ([x, y]: number[]): [number, number] => [x, y]

/** Measurement for a Terra Draw feature, or undefined for the helper points drawing modes add; `elevationM` as in Measurement. */
export function featureMeasurement(f: GeoJSONStoreFeatures, elevationM?: number | null): Measurement | undefined {
  const mode = f.properties.mode
  const id = f.id
  if (!isMeasureMode(mode) || id === undefined) return undefined
  const g = f.geometry
  const finished = !f.properties.currentlyDrawing
  if (g.type === 'LineString') {
    const segmentsM = segmentLengthsM(g.coordinates)
    return { id, mode, path: finished ? g.coordinates.map(toPair) : undefined, lengthM: segmentsM.reduce((a, b) => a + b, 0), segmentsM }
  }
  if (g.type === 'Polygon') {
    return { id, mode, ring: finished ? g.coordinates[0].map(toPair) : undefined, areaM2: area(f), perimeterM: length(f, { units: 'meters' }) }
  }
  // Line and polygon modes add helper points (closing, snapping) while drawing
  if (mode !== 'point') return undefined
  return { id, mode, coordinates: toPair(g.coordinates), elevationM }
}

/** Features that can go back into a new Terra Draw: finished measurements, not a half-drawn one or its helpers. */
export function restorableFeatures(snapshot: GeoJSONStoreFeatures[]) {
  return snapshot.filter((f) => {
    const mode = f.properties.mode
    return isMeasureMode(mode) && !f.properties.currentlyDrawing && (f.geometry.type !== 'Point' || mode === 'point')
  })
}

/** Where a feature's value label sits: a line's last vertex, a polygon's visual center (its first corner while drawn), the point. */
export function labelPoint(f: GeoJSONStoreFeatures): [number, number] | undefined {
  const g = f.geometry
  if (g.type === 'Point') return toPair(g.coordinates)
  if (g.type === 'LineString') return toPair(g.coordinates[g.coordinates.length - 1])
  // polylabel is too slow to rerun on every pointer move
  if (g.type === 'Polygon' && f.properties.currentlyDrawing) return toPair(g.coordinates[0][0])
  if (g.type === 'Polygon') return toPair(polylabel(g.coordinates.map((ring) => ring.map(toPair)), 0.0001))
  return undefined
}

export function labelText(m: Measurement, units: UnitSystem) {
  const q = measurementQuantity(m, units)
  return q ? formatQuantity(q) : ''
}
