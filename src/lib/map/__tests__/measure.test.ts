import { describe, expect, it } from 'vitest'
import { formatArea, formatElevation, formatLength } from '../measure-store'
import { bilinear, decodeTerrarium, gridInRing, groundDistanceM, samplePath, slopeAngle, worldPixel } from '../dem-elevation'

describe('formatLength', () => {
  it('uses feet under 1,000 ft', () => {
    expect(formatLength(100)).toEqual({ value: 328, unit: 'ft' })
  })
  it('switches to miles at 1,000 ft', () => {
    expect(formatLength(1609.344)).toEqual({ value: 1, unit: 'mi' })
  })
})

describe('formatArea', () => {
  it('uses acres under a square mile', () => {
    expect(formatArea(4046.8564224 * 10)).toEqual({ value: 10, unit: 'acres' })
  })
  it('switches to square miles at 640 acres', () => {
    expect(formatArea(2589988.110336 * 2)).toEqual({ value: 2, unit: 'mi²' })
  })
})

describe('metric units', () => {
  it('uses meters under 1,000 m, else kilometers', () => {
    expect(formatLength(250.4, 'metric')).toEqual({ value: 250, unit: 'm' })
    expect(formatLength(2500, 'metric')).toEqual({ value: 2.5, unit: 'km' })
  })
  it('uses hectares under 1 km², else km²', () => {
    expect(formatArea(50_000, 'metric')).toEqual({ value: 5, unit: 'ha' })
    expect(formatArea(3_000_000, 'metric')).toEqual({ value: 3, unit: 'km²' })
  })
  it('gives elevation in feet or meters', () => {
    expect(formatElevation(1000)).toEqual({ value: 3281, unit: 'ft' })
    expect(formatElevation(1000.4, 'metric')).toEqual({ value: 1000, unit: 'm' })
  })
})

describe('groundDistanceM', () => {
  it('follows the terrain between samples', () => {
    // 300 m flat then a 400 m run that climbs 300 m (a 3-4-5 triangle)
    const samples = [{ distanceM: 0, elevationM: 100 }, { distanceM: 300, elevationM: 100 }, { distanceM: 700, elevationM: 400 }]
    expect(groundDistanceM(samples)).toBeCloseTo(800)
  })
})

describe('surface area helpers', () => {
  it('gives a 45° slope for a rise equal to the run', () => {
    expect((slopeAngle(30, 0) * 180) / Math.PI).toBeCloseTo(45)
    expect(slopeAngle(0, 0)).toBe(0)
  })
  it('caps the grid near 1,500 points inside the ring', () => {
    // ~1.1 km square near Salt Lake City
    const ring: [number, number][] = [[-111.9, 40.7], [-111.887, 40.7], [-111.887, 40.71], [-111.9, 40.71], [-111.9, 40.7]]
    const n = gridInRing(ring, 1_200_000).length
    expect(n).toBeGreaterThan(1000)
    expect(n).toBeLessThanOrEqual(1600)
  })
})

describe('DEM helpers', () => {
  it('decodes Terrarium RGB to meters', () => {
    // 32768 + 1500.5 m
    expect(decodeTerrarium(133, 220, 128)).toBeCloseTo(1500.5)
  })
  it('puts a lng/lat in z13 world pixels', () => {
    // Null Island is the middle of the 2^13 x 256 px world
    expect(worldPixel(0, 0)).toEqual({ x: 4096 * 256, y: 4096 * 256 })
  })
  it('blends four corners bilinearly', () => {
    expect(bilinear(0, 10, 20, 30, 0, 0)).toBe(0)
    expect(bilinear(0, 10, 20, 30, 1, 1)).toBe(30)
    expect(bilinear(0, 10, 20, 30, 0.5, 0.5)).toBe(15)
  })
})

describe('samplePath', () => {
  it('spaces samples evenly across vertices, ending at the last one', () => {
    const samples = samplePath([[-112, 40], [-111.99, 40], [-111.99, 40.01]], 5)
    expect(samples).toHaveLength(5)
    expect(samples[0]).toMatchObject({ distanceM: 0, lng: -112, lat: 40 })
    expect(samples[4].lng).toBeCloseTo(-111.99)
    expect(samples[4].lat).toBeCloseTo(40.01)
    const gaps = samples.slice(1).map((s, i) => s.distanceM - samples[i].distanceM)
    gaps.forEach((g) => expect(g).toBeCloseTo(gaps[0]))
  })
})
