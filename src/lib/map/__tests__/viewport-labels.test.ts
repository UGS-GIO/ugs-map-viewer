import { describe, it, expect } from 'vitest'
import type { Feature } from 'geojson'
import { viewportLabelPoints } from '../viewport-labels'

const square = (id: number, x0: number, y0: number, size: number, props = {}): Feature => ({
    type: 'Feature',
    id,
    properties: { name: `c${id}`, ...props },
    geometry: {
        type: 'Polygon',
        coordinates: [[[x0, y0], [x0 + size, y0], [x0 + size, y0 + size], [x0, y0 + size], [x0, y0]]],
    },
})

const WORLD: [number, number, number, number] = [-180, -85, 180, 85]

describe('viewportLabelPoints', () => {
    it('labels a feature split across tiles once, in its largest piece', () => {
        // One county cut by a tile edge at x=1: a 1-wide sliver and a 3-wide main piece
        const fc = viewportLabelPoints([square(7, 0, 0, 1), square(7, 1, 0, 3)], WORLD)
        expect(fc.features).toHaveLength(1)
        const [x, y] = fc.features[0].geometry.coordinates
        expect(x).toBeGreaterThan(1)
        expect(x).toBeLessThan(4)
        expect(y).toBeGreaterThan(0)
        expect(fc.features[0].properties).toEqual({ name: 'c7' })
        expect(fc.features[0].id).toBe(7)
    })

    it('labels each feature id separately', () => {
        const fc = viewportLabelPoints([square(1, 0, 0, 1), square(2, 5, 5, 1)], WORLD)
        expect(fc.features.map(f => f.id).sort()).toEqual([1, 2])
    })

    it('keeps the label inside the view when the feature runs off screen', () => {
        // View covers only the left quarter of a 4-wide county
        const fc = viewportLabelPoints([square(3, 0, 0, 4)], [0, 0, 1, 4])
        const [x] = fc.features[0].geometry.coordinates
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
    })

    it('skips features outside the view, without ids, or without polygons', () => {
        const noId = { ...square(9, 0, 0, 1), id: undefined }
        const point: Feature = { type: 'Feature', id: 4, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
        expect(viewportLabelPoints([square(5, 50, 50, 1), noId, point], [0, 0, 10, 10]).features).toEqual([])
    })
})
