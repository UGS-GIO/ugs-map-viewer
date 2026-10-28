import { describe, it, expect } from 'vitest'
import { LngLat, type PointLike } from 'maplibre-gl'
import { polygonBounds, screenBoxToPolygon } from '../geometry-utils'

/** 1 px = 0.001°, screen y grows downward, optionally rotated about the origin by `bearing` degrees. */
function fakeMap(bearing = 0) {
  const r = (bearing * Math.PI) / 180
  return {
    unproject: (p: PointLike) => {
      const [x, y] = Array.isArray(p) ? p : [p.x, p.y]
      return new LngLat((x * Math.cos(r) - y * Math.sin(r)) / 1000, -(x * Math.sin(r) + y * Math.cos(r)) / 1000)
    },
  }
}

describe('screenBoxToPolygon', () => {
  it('unprojects all four corners into a closed ring', () => {
    const ring = screenBoxToPolygon(fakeMap(), [0, 0], [100, 100]).coordinates[0]
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    expect(ring.slice(0, 4)).toEqual([[0, -0], [0.1, -0], [0.1, -0.1], [0, -0.1]])
  })

  it('keeps the true ground shape when the map is rotated, not just two opposite corners', () => {
    const ring = screenBoxToPolygon(fakeMap(45), [-50, -50], [50, 50]).coordinates[0]
    // A screen square rotated 45° is a diamond on the ground: its corners sit on the axes
    const onAxis = ring.slice(0, 4).filter(([lng, lat]) => Math.abs(lng) < 1e-9 || Math.abs(lat) < 1e-9)
    expect(onAxis).toHaveLength(4)
  })
})

describe('polygonBounds', () => {
  it('returns the polygon extent as sw/ne', () => {
    const box = screenBoxToPolygon(fakeMap(45), [-50, -50], [50, 50])
    const { sw, ne } = polygonBounds(box)
    expect(sw[0]).toBeCloseTo(-0.0707, 4)
    expect(ne[1]).toBeCloseTo(0.0707, 4)
  })
})
