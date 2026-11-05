import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import type { GeoJSONStoreFeatures } from 'terra-draw'
import { area } from '@turf/area'
import { length } from '@turf/length'
import { coordAll } from '@turf/meta'
import polylabel from 'polylabel'
import { segmentLengthsM } from './dem-elevation'
import { formatQuantity, isMeasureMode, measurementQuantity, type MeasureMode, type Measurement, type UnitSystem } from './measure-store'

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
    case 'MultiLineString': return isRings(c) ? c.flatMap(line) : []
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

/** Whether every shape's coordinates fit longitude/latitude, rather than a projected CRS's meters. */
export function inLngLat(shapes: LoadedShape[]) {
  return coordAll({ type: 'GeometryCollection', geometries: shapes.map((s) => s.geometry) }).every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90)
}

const LAYER_BY_MODE = { linestring: 'lines', polygon: 'areas', point: 'points' } as const

/**
 * Finished measurements as GeoJSON, a layer per kind (formats like Shapefile take one geometry type
 * each). `name` matches the panel's row title; sizes are in meters, `label` in the chosen units.
 */
export function measurementLayers(ms: Measurement[], nameOf: (m: Measurement, i: number) => string, units: UnitSystem) {
  const layers = new Map<string, Feature[]>()
  ms.forEach((m, i) => {
    const geometry: LineString | Polygon | Point | undefined = m.path
      ? { type: 'LineString', coordinates: m.path }
      : m.ring ? { type: 'Polygon', coordinates: [m.ring] }
      : m.coordinates && { type: 'Point', coordinates: m.coordinates }
    // A shape still being drawn has none of these yet
    if (!geometry) return
    const properties = { name: nameOf(m, i), label: labelText(m, units), length_m: m.lengthM, area_m2: m.areaM2, perim_m: m.perimeterM, elev_m: m.elevationM }
    const layer = LAYER_BY_MODE[m.mode]
    layers.set(layer, [...(layers.get(layer) ?? []), { type: 'Feature', geometry, properties }])
  })
  return [...layers].map(([name, features]): [string, FeatureCollection] => [name, { type: 'FeatureCollection', features }])
}
