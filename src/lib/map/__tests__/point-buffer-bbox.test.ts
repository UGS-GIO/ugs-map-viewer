import { describe, it, expect } from 'vitest'
import { LngLat } from 'maplibre-gl'
import { createPointBufferBbox } from '../utils'

describe('createPointBufferBbox', () => {
  it.each([[[-111.89, 40.76], 0.1], [[-113.5, 37.2], 1], [[-109.05, 41.99], 0.5]] as const)(
    'puts each edge one radius from %j (%s km)',
    ([lng, lat], radiusKm) => {
      const [minX, minY, maxX, maxY] = createPointBufferBbox([lng, lat], radiusKm)!
      const center = new LngLat(lng, lat)
      for (const edge of [new LngLat(minX, lat), new LngLat(maxX, lat), new LngLat(lng, minY), new LngLat(lng, maxY)]) {
        expect(center.distanceTo(edge) / 1000).toBeCloseTo(radiusKm, 2)
      }
    },
  )
})
