import { describe, it, expect, vi, beforeEach } from 'vitest'

// The protocol registration is the only part that touches MapLibre; the index
// registry and tile lookup below are pure, so the module is stubbed out.
vi.mock('maplibre-gl', () => ({
    default: { config: {}, addProtocol: vi.fn() },
}))

import {
    registerGeoJsonVtSource,
    unregisterGeoJsonVtSource,
    geojsonVtTileUrl,
    GEOJSONVT_PROTOCOL,
    TILE_MAX_ZOOM,
} from '@/lib/map/user-layers/geojson-vt-protocol'

const polygon = (x: number, y: number): GeoJSON.Feature => ({
    type: 'Feature',
    properties: { name: `p${x}` },
    geometry: {
        type: 'Polygon',
        coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]],
    },
})

const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features,
})

describe('registerGeoJsonVtSource', () => {
    beforeEach(() => {
        unregisterGeoJsonVtSource('layer-a')
        unregisterGeoJsonVtSource('layer-b')
    })

    it('reuses the index when handed the same collection', () => {
        const fc = collection([polygon(0, 0)])
        const first = registerGeoJsonVtSource('layer-a', fc)
        const second = registerGeoJsonVtSource('layer-a', fc)
        expect(second).toBe(first)
    })

    it('bumps the revision when the collection changes, so cached tiles are dropped', () => {
        const first = registerGeoJsonVtSource('layer-a', collection([polygon(0, 0)]))
        const second = registerGeoJsonVtSource('layer-a', collection([polygon(5, 5)]))
        expect(second).toBeGreaterThan(first)
    })

    it('keeps revisions per layer', () => {
        const a = registerGeoJsonVtSource('layer-a', collection([polygon(0, 0)]))
        const b = registerGeoJsonVtSource('layer-b', collection([polygon(0, 0)]))
        expect(a).toBe(1)
        expect(b).toBe(1)
    })

    it('restarts a layer that was unregistered and re-added', () => {
        registerGeoJsonVtSource('layer-a', collection([polygon(0, 0)]))
        unregisterGeoJsonVtSource('layer-a')
        expect(registerGeoJsonVtSource('layer-a', collection([polygon(0, 0)]))).toBe(1)
    })

    it('indexes a collection large enough to need tiling without throwing', () => {
        const many = collection(
            Array.from({ length: 5000 }, (_, i) => polygon((i % 100) * 0.1 - 111, Math.floor(i / 100) * 0.1 + 39)),
        )
        expect(() => registerGeoJsonVtSource('layer-a', many)).not.toThrow()
    })
})

describe('geojsonVtTileUrl', () => {
    it('builds a template MapLibre can expand', () => {
        expect(geojsonVtTileUrl('wells')).toBe(`${GEOJSONVT_PROTOCOL}://wells/{z}/{x}/{y}`)
    })

    it('encodes a key with spaces and slashes so the z/x/y split stays unambiguous', () => {
        const url = geojsonVtTileUrl('My Layer / 2')
        expect(url).toBe(`${GEOJSONVT_PROTOCOL}://My%20Layer%20%2F%202/{z}/{x}/{y}`)
        // Exactly the three template segments follow the key.
        expect(url.slice(`${GEOJSONVT_PROTOCOL}://`.length).split('/')).toHaveLength(4)
    })
})

describe('tile zoom ceiling', () => {
    it('matches what the source advertises as maxzoom', () => {
        // The index is only built to this zoom; MapLibre over-zooms past it. A
        // source claiming more would request tiles the index cannot answer.
        expect(TILE_MAX_ZOOM).toBe(16)
    })
})
