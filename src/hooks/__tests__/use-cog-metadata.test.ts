import { describe, it, expect } from 'vitest'
import { deriveRange, computeCogPixelPolygon, type CogMetadata } from '../use-cog-metadata'

const baseStats: CogMetadata = {
    minimum: -100,
    maximum: 200,
    mean: 50,
    stddev: 25,
}

describe('deriveRange', () => {
    it('minmax returns the raw [min, max]', () => {
        expect(deriveRange(baseStats, 'minmax')).toEqual([-100, 200])
    })

    it('sigma returns mean ± 2σ', () => {
        expect(deriveRange(baseStats, 'sigma')).toEqual([0, 100])
    })
})

describe('computeCogPixelPolygon', () => {
    // 1°×1° pixels, origin at (0, 0) upper-left. Pure WGS84 → no projection math.
    const grid: CogMetadata = {
        ...baseStats,
        pixelSize: [1, 1],
        origin: [0, 0],
        epsg: 4326,
    }

    it('returns null when pixelSize is missing', () => {
        const noPx: CogMetadata = { ...baseStats, origin: [0, 0], epsg: 4326 }
        expect(computeCogPixelPolygon({ lng: 0, lat: 0 }, noPx)).toBeNull()
    })

    it('returns null when origin is missing', () => {
        const noOrigin: CogMetadata = { ...baseStats, pixelSize: [1, 1], epsg: 4326 }
        expect(computeCogPixelPolygon({ lng: 0, lat: 0 }, noOrigin)).toBeNull()
    })

    it('snaps a click to the containing pixel cell', () => {
        // click at (2.5, -3.5) → col 2, row 3 → cell lng [2, 3], lat [-4, -3]
        const poly = computeCogPixelPolygon({ lng: 2.5, lat: -3.5 }, grid)
        expect(poly).not.toBeNull()
        expect(poly!.type).toBe('Polygon')

        const ring = poly!.coordinates[0]
        expect(ring).toHaveLength(5)
        // ll, lr, ur, ul, ll (closed)
        expect(ring[0]).toEqual([2, -4])
        expect(ring[1]).toEqual([3, -4])
        expect(ring[2]).toEqual([3, -3])
        expect(ring[3]).toEqual([2, -3])
        expect(ring[4]).toEqual(ring[0])
    })
})
