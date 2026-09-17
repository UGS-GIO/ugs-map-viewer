import { describe, it, expect } from 'vitest'
import type { FeatureCollection } from 'geojson'
import { isUsableExtent, extentFromBbox, geojsonExtent } from '../extent'

describe('isUsableExtent', () => {
    it('accepts a WGS84 box', () => {
        expect(isUsableExtent([-112, 38, -111, 39])).toBe(true)
    })

    it('rejects projected metres, inverted corners, and non-arrays', () => {
        expect(isUsableExtent([-12468408, 4607012, -12449457, 4587450])).toBe(false)
        expect(isUsableExtent([-111, 39, -112, 38])).toBe(false)
        expect(isUsableExtent(undefined)).toBe(false)
        expect(isUsableExtent([-112, 38, -111])).toBe(false)
        expect(isUsableExtent([NaN, 38, -111, 39])).toBe(false)
    })
})

describe('extentFromBbox', () => {
    it('passes a 2D bbox through', () => {
        expect(extentFromBbox([-112, 38, -111, 39])).toEqual([-112, 38, -111, 39])
    })

    it('drops the elevation pair from a 3D bbox', () => {
        expect(extentFromBbox([-112, 38, 1200, -111, 39, 3000])).toEqual([-112, 38, -111, 39])
    })

    it('returns undefined for a missing or unusable bbox', () => {
        expect(extentFromBbox(undefined)).toBeUndefined()
        expect(extentFromBbox([0, 0])).toBeUndefined()
    })
})

describe('geojsonExtent', () => {
    const fc = (coords: number[][]): FeatureCollection => ({
        type: 'FeatureCollection',
        features: coords.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} })),
    })

    it('spans every coordinate', () => {
        expect(geojsonExtent(fc([[-112, 38], [-111, 39], [-111.5, 38.5]]))).toEqual([-112, 38, -111, 39])
    })

    it('handles a single point', () => {
        expect(geojsonExtent(fc([[-111.9, 38.1]]))).toEqual([-111.9, 38.1, -111.9, 38.1])
    })

    it('returns undefined for an empty collection', () => {
        expect(geojsonExtent(fc([]))).toBeUndefined()
    })
})
