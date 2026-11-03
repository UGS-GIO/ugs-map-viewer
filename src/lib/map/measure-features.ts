import type { LineString, Point, Polygon } from 'geojson'
import type { GeoJSONStoreFeatures } from 'terra-draw'
import { area } from '@turf/area'
import { length } from '@turf/length'
import { lineString } from '@turf/helpers'
import polylabel from 'polylabel'
import { formatQuantity, isMeasureMode, measurementQuantity, type MeasureMode, type Measurement, type UnitSystem } from './measure-store'

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

export interface LoadedShape {
  mode: MeasureMode
  geometry: LineString | Polygon | Point
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isPosition = (v: unknown): v is number[] => Array.isArray(v) && v.length >= 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n))
const isPositions = (v: unknown): v is number[][] => Array.isArray(v) && v.every(isPosition)
const isRings = (v: unknown): v is number[][][] => Array.isArray(v) && v.every(isPositions)

// Terra Draw rejects coordinates past its precision (9 places) and only draws 2D
const pos = (p: number[]): [number, number] => [Number(p[0].toFixed(9)), Number(p[1].toFixed(9))]

function line(coords: number[][]): LoadedShape[] {
  return coords.length >= 2 ? [{ mode: 'linestring', geometry: { type: 'LineString', coordinates: coords.map(pos) } }] : []
}

// Outer ring only: Terra Draw polygons don't take holes
function poly(rings: number[][][]): LoadedShape[] {
  return rings[0]?.length >= 4 ? [{ mode: 'polygon', geometry: { type: 'Polygon', coordinates: [rings[0].map(pos)] } }] : []
}

function fromGeometry(g: unknown): LoadedShape[] {
  if (!isObject(g)) return []
  const c = g.coordinates
  switch (g.type) {
    case 'Point': return isPosition(c) ? [{ mode: 'point', geometry: { type: 'Point', coordinates: pos(c) } }] : []
    case 'MultiPoint': return isPositions(c) ? c.map((p) => ({ mode: 'point', geometry: { type: 'Point', coordinates: pos(p) } })) : []
    case 'LineString': return isPositions(c) ? line(c) : []
    case 'MultiLineString': return Array.isArray(c) && c.every(isPositions) ? c.flatMap(line) : []
    case 'Polygon': return isRings(c) ? poly(c) : []
    case 'MultiPolygon': return Array.isArray(c) && c.every(isRings) ? c.flatMap(poly) : []
    case 'GeometryCollection': return Array.isArray(g.geometries) ? g.geometries.flatMap(fromGeometry) : []
    default: return []
  }
}

/** Measurable shapes in parsed GeoJSON (a FeatureCollection, Feature or bare geometry); multi-parts split. */
export function shapesFromGeoJSON(json: unknown): LoadedShape[] {
  if (!isObject(json)) return []
  if (json.type === 'FeatureCollection') return Array.isArray(json.features) ? json.features.flatMap(shapesFromGeoJSON) : []
  if (json.type === 'Feature') return fromGeometry(json.geometry)
  return fromGeometry(json)
}
