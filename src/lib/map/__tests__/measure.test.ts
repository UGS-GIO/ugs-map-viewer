import { describe, expect, it } from 'vitest'
import { formatArea, formatLength } from '../measure-store'
import { decodeTerrarium, samplePath, tilePixel } from '../dem-elevation'

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

describe('DEM helpers', () => {
  it('decodes Terrarium RGB to meters', () => {
    // 32768 + 1500.5 m
    expect(decodeTerrarium(133, 220, 128)).toBeCloseTo(1500.5)
  })
  it('finds the z13 tile and pixel for a lng/lat', () => {
    // Null Island sits on the corner of tiles 4096/4096
    expect(tilePixel(0, 0)).toEqual({ x: 4096, y: 4096, px: 0, py: 0 })
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
