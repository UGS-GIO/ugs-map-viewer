import { describe, expect, it } from 'vitest'
import { scaleDenominator, zoomForScale } from '../map-scale'

// Web Mercator ground resolution for MapLibre's 512px tiles.
const metersPerPixel = (zoom: number, lat: number) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)

describe('scaleDenominator', () => {
  it('matches the standard 96-dpi scale at the equator', () => {
    // 1:295,829,355 at zoom 0 for 512px tiles
    expect(scaleDenominator(metersPerPixel(0, 0))).toBeCloseTo(295_829_355, -2)
  })

  it('reads about 1:223,000 at zoom 10 in central Utah', () => {
    expect(Math.round(scaleDenominator(metersPerPixel(10, 39.5)) / 1000)).toBe(223)
  })

  it('halves each zoom level', () => {
    const z12 = scaleDenominator(metersPerPixel(12, 40))
    const z13 = scaleDenominator(metersPerPixel(13, 40))
    expect(z12 / z13).toBeCloseTo(2, 6)
  })
})

describe('zoomForScale', () => {
  // What the footer reads: haversine distance (MapLibre's mean radius) across
  // 100 px at the view center, divided by 100.
  const readoutMetersPerPixel = (zoom: number, lat: number) => {
    const phi = (lat * Math.PI) / 180
    const dLambda = ((100 * 360) / (512 * 2 ** zoom)) * (Math.PI / 180)
    const cosAngle = Math.sin(phi) ** 2 + Math.cos(phi) ** 2 * Math.cos(dLambda)
    return (6_371_008.8 * Math.acos(Math.min(cosAngle, 1))) / 100
  }

  it('lands on the zoom where the footer reads the same scale', () => {
    for (const lat of [37, 39.5, 42]) {
      const z = zoomForScale(scaleDenominator(readoutMetersPerPixel(11.8, lat)), lat)
      expect(z).toBeCloseTo(11.8, 4)
    }
  })

  it('puts 1:62,500 just under zoom 12 in central Utah', () => {
    expect(zoomForScale(62_500, 39.5)).toBeCloseTo(11.83, 2)
  })
})
