import { describe, expect, it } from 'vitest'
import type { GeoJSONStoreFeatures } from 'terra-draw'
import { featureMeasurement, inLngLat, labelPoint, labelText, measurementLayers, restorableFeatures, shapesFromGeoJSON } from '../measure-features'
import { layersToRaise } from '../measure-layers'

const line = (currentlyDrawing = false): GeoJSONStoreFeatures => ({
  type: 'Feature',
  id: 'l',
  geometry: { type: 'LineString', coordinates: [[-111.9, 40.7], [-111.9, 40.71], [-111.89, 40.71]] },
  properties: { mode: 'linestring', currentlyDrawing },
})
const square = (currentlyDrawing = false): GeoJSONStoreFeatures => ({
  type: 'Feature',
  id: 'a',
  geometry: { type: 'Polygon', coordinates: [[[-111.9, 40.7], [-111.89, 40.7], [-111.89, 40.71], [-111.9, 40.71], [-111.9, 40.7]]] },
  properties: { mode: 'polygon', currentlyDrawing },
})
const point = (mode = 'point'): GeoJSONStoreFeatures => ({
  type: 'Feature',
  id: `p-${mode}`,
  geometry: { type: 'Point', coordinates: [-111.9, 40.7] },
  properties: { mode },
})

describe('featureMeasurement', () => {
  it('measures each leg of a line and keeps the path once finished', () => {
    const m = featureMeasurement(line(), undefined)
    expect(m?.segmentsM).toHaveLength(2)
    expect(m?.lengthM).toBeCloseTo(m!.segmentsM![0] + m!.segmentsM![1])
    expect(m?.path).toHaveLength(3)
  })
  it('leaves out the path while a line is still being drawn', () => {
    expect(featureMeasurement(line(true), undefined)?.path).toBeUndefined()
  })
  it('gives a polygon area and perimeter, and its ring once finished', () => {
    const m = featureMeasurement(square(), undefined)
    expect(m?.areaM2).toBeGreaterThan(900_000)
    expect(m?.perimeterM).toBeGreaterThan(3_800)
    expect(m?.ring).toHaveLength(5)
    expect(featureMeasurement(square(true), undefined)?.ring).toBeUndefined()
  })
  it('maps a point lookup to meters, pending (undefined) or failed (null)', () => {
    expect(featureMeasurement(point(), 1500)?.elevationM).toBe(1500)
    expect(featureMeasurement(point(), undefined)?.elevationM).toBeUndefined()
    expect(featureMeasurement(point(), null)?.elevationM).toBeNull()
  })
  it('skips the helper points line and polygon modes add', () => {
    expect(featureMeasurement(point('linestring'), undefined)).toBeUndefined()
  })
})

describe('restorableFeatures', () => {
  it('keeps finished measurements and drops a half-drawn one and helper points', () => {
    const kept = restorableFeatures([line(), line(true), square(), point(), point('polygon')])
    expect(kept.map((f) => [f.id, f.properties.currentlyDrawing])).toEqual([['l', false], ['a', false], ['p-point', undefined]])
  })
})

describe('layersToRaise', () => {
  it('returns nothing when ours are already on top', () => {
    expect(layersToRaise(['basemap', 'data', 'measure-td-a', 'measure-td-b'])).toEqual([])
  })
  it('returns ours in order when a data layer lands above them', () => {
    expect(layersToRaise(['basemap', 'measure-td-a', 'measure-td-b', 'data'])).toEqual(['measure-td-a', 'measure-td-b'])
  })
  it('returns nothing before our layers exist', () => {
    expect(layersToRaise(['basemap', 'data'])).toEqual([])
  })
})

describe('labels', () => {
  it('sits a line label on its last vertex', () => {
    expect(labelPoint(line())).toEqual([-111.89, 40.71])
  })
  it('puts a polygon label inside it', () => {
    const [x, y] = labelPoint(square())!
    expect(x).toBeGreaterThan(-111.9)
    expect(x).toBeLessThan(-111.89)
    expect(y).toBeGreaterThan(40.7)
    expect(y).toBeLessThan(40.71)
  })
  it('labels in the chosen units, and stays empty while a point elevation loads', () => {
    expect(labelText({ id: 1, mode: 'linestring', lengthM: 1609.344 }, 'us')).toBe('1 mi')
    expect(labelText({ id: 1, mode: 'linestring', lengthM: 1609.344 }, 'metric')).toBe('1.61 km')
    expect(labelText({ id: 2, mode: 'point' }, 'us')).toBe('')
  })
})

describe('shapesFromGeoJSON', () => {
  it('splits multi-parts and maps each geometry to a measure tool', () => {
    const shapes = shapesFromGeoJSON({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.2]]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [5, 5, 1200] } },
      ],
    })
    expect(shapes.map((s) => s.mode)).toEqual(['linestring', 'linestring', 'polygon', 'point'])
    // Holes dropped, Z dropped
    expect(shapes[2].geometry.coordinates).toHaveLength(1)
    expect(shapes[3].geometry.coordinates).toEqual([5, 5])
  })
  it('rounds to the 9 decimals Terra Draw accepts', () => {
    const [s] = shapesFromGeoJSON({ type: 'Point', coordinates: [-111.1234567891234, 40.1] })
    expect(s.geometry.coordinates).toEqual([-111.123456789, 40.1])
  })
  it('skips junk and degenerate shapes', () => {
    expect(shapesFromGeoJSON('nope')).toEqual([])
    expect(shapesFromGeoJSON({ type: 'LineString', coordinates: [[0, 0]] })).toEqual([])
    expect(shapesFromGeoJSON({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] })).toEqual([])
    expect(shapesFromGeoJSON({ type: 'Point', coordinates: ['a', 1] })).toEqual([])
  })
})

describe('inLngLat', () => {
  it('tells longitude/latitude from projected meters', () => {
    expect(inLngLat(shapesFromGeoJSON({ type: 'Point', coordinates: [-111.9, 40.7] }))).toBe(true)
    expect(inLngLat(shapesFromGeoJSON({ type: 'Point', coordinates: [430000, 4500000] }))).toBe(false)
  })
})

describe('measurementLayers', () => {
  const name = (m: { mode: string }, i: number) => `${m.mode} ${i + 1}`
  it('splits finished measurements into a layer per kind, skipping one still being drawn', () => {
    const layers = measurementLayers([
      { id: 1, mode: 'linestring', path: [[0, 0], [1, 0]], lengthM: 111_000, segmentsM: [111_000] },
      { id: 2, mode: 'point', coordinates: [0, 0], elevationM: 1500 },
      { id: 3, mode: 'linestring', lengthM: 5, segmentsM: [5] },
      { id: 4, mode: 'polygon', ring: [[0, 0], [1, 0], [1, 1], [0, 0]], areaM2: 6e9, perimeterM: 3e5 },
    ], name, 'metric')
    expect(layers.map(([n, fc]) => [n, fc.features.length])).toEqual([['lines', 1], ['points', 1], ['areas', 1]])
    expect(layers[0][1].features[0].properties).toMatchObject({ name: 'linestring 1', length_m: 111_000, label: '111 km' })
    expect(layers[1][1].features[0]).toMatchObject({ geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'point 2', elev_m: 1500 } })
    expect(layers[2][1].features[0].geometry).toEqual({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] })
  })
})
