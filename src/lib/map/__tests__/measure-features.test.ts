import { describe, expect, it } from 'vitest'
import type { GeoJSONStoreFeatures } from 'terra-draw'
import { featureMeasurement, labelPoint, labelText, restorableFeatures } from '../measure-features'
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
