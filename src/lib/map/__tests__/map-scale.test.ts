import { describe, expect, it } from 'vitest'
import { scaleDenominator } from '../map-scale'

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
