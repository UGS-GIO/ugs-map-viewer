import { describe, it, expect } from 'vitest'
import type { Feature } from 'geojson'
import { labelDiff, viewportLabelPoints } from '../viewport-labels'

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
const xy = (labels: ReturnType<typeof viewportLabelPoints>, id: number) => labels.get(id)?.geometry.coordinates ?? []

describe('viewportLabelPoints', () => {
    it('labels a feature split across tiles once, in its largest piece', () => {
        // One county cut by a tile edge at x=1: a 1-wide sliver and a 3-wide main piece
        const labels = viewportLabelPoints([square(7, 0, 0, 1), square(7, 1, 0, 3)], WORLD)
        expect(labels.size).toBe(1)
        const [x, y] = xy(labels, 7)
        expect(x).toBeGreaterThan(1)
        expect(x).toBeLessThan(4)
        expect(y).toBeGreaterThan(0)
        expect(labels.get(7)?.properties).toEqual({ name: 'c7' })
    })

    it('labels each feature id separately', () => {
        const labels = viewportLabelPoints([square(1, 0, 0, 1), square(2, 5, 5, 1)], WORLD)
        expect([...labels.keys()].sort()).toEqual([1, 2])
    })

    it('keeps the label inside the view when the feature runs off screen', () => {
        // View covers only the left quarter of a 4-wide county
        const [x] = xy(viewportLabelPoints([square(3, 0, 0, 4)], [0, 0, 1, 4]), 3)
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
    })

    it('leaves a label where it was while it stays inside the visible part', () => {
        const first = viewportLabelPoints([square(3, 0, 0, 4)], [0, 0, 4, 4])
        // Pan right a little: the old label is still on screen and inside the county
        const panned = viewportLabelPoints([square(3, 0, 0, 4)], [1, 0, 5, 4], first)
        expect(panned.get(3)).toBe(first.get(3))
        // Pan until the old label is off screen: it moves into view
        const [x] = xy(viewportLabelPoints([square(3, 0, 0, 4)], [3, 0, 7, 4], first), 3)
        expect(x).toBeGreaterThanOrEqual(3)
    })

    it('skips features outside the view, without ids, or without polygons', () => {
        const noId = { ...square(9, 0, 0, 1), id: undefined }
        const point: Feature = { type: 'Feature', id: 4, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }
        expect(viewportLabelPoints([square(5, 50, 50, 1), noId, point], [0, 0, 10, 10]).size).toBe(0)
    })
})

describe('labelDiff', () => {
    it('is null when no label changed, so a pan sends nothing', () => {
        const labels = viewportLabelPoints([square(1, 0, 0, 2)], WORLD)
        expect(labelDiff(labels, new Map(labels))).toBeNull()
    })

    it('adds new labels, removes gone ones and moves changed ones', () => {
        const before = viewportLabelPoints([square(1, 0, 0, 2), square(2, 10, 10, 2)], WORLD)
        const after = viewportLabelPoints([square(2, 10, 10, 2), square(3, 20, 20, 2)], [9, 9, 30, 30])
        const diff = labelDiff(before, after)
        expect(diff?.remove).toEqual([1])
        expect(diff?.add?.map(f => f.id)).toEqual([3])
        expect(diff?.update?.map(u => u.id)).toEqual([2])
    })
})
