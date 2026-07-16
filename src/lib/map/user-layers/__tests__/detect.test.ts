import { describe, it, expect } from 'vitest'
import { detectFormatFromUrl, titleFromUrl, colorFromTitle, buildLayerFromFile } from '../detect'

describe('detectFormatFromUrl', () => {
    it('detects PMTiles', () => {
        expect(detectFormatFromUrl('https://x.org/a/hazards.pmtiles')).toBe('pmtiles')
    })

    it('detects GeoJSON', () => {
        expect(detectFormatFromUrl('https://x.org/a/faults.geojson')).toBe('geojson')
    })

    it('detects COG for .tif and .tiff', () => {
        expect(detectFormatFromUrl('https://x.org/a/gravity.tif')).toBe('cog')
        expect(detectFormatFromUrl('https://x.org/a/gravity.tiff')).toBe('cog')
    })

    it('detects WMS from a /wms endpoint or a service=WMS param', () => {
        expect(detectFormatFromUrl('https://x.org/geoserver/hazards/wms')).toBe('wms')
        expect(detectFormatFromUrl('https://x.org/geoserver/ows?service=WMS&request=GetMap')).toBe('wms')
    })

    it('treats a bare .json as STAC (resolved on fetch)', () => {
        expect(detectFormatFromUrl('https://x.org/stac/item.json')).toBe('stac')
    })

    it('ignores query strings when sniffing the extension', () => {
        expect(detectFormatFromUrl('https://x.org/a/faults.geojson?token=abc')).toBe('geojson')
    })

    it('returns unknown for unsupported input', () => {
        expect(detectFormatFromUrl('https://x.org/a/data.csv')).toBe('unknown')
    })
})

describe('titleFromUrl', () => {
    it('strips path and extension', () => {
        expect(titleFromUrl('https://x.org/a/b/quaternary_faults.pmtiles')).toBe('quaternary_faults')
    })

    it('strips a query string', () => {
        expect(titleFromUrl('https://x.org/a/faults.geojson?v=2')).toBe('faults')
    })
})

describe('colorFromTitle', () => {
    it('is deterministic for the same title', () => {
        expect(colorFromTitle('faults')).toBe(colorFromTitle('faults'))
    })

    it('returns a hex colour', () => {
        expect(colorFromTitle('anything')).toMatch(/^#[0-9a-f]{6}$/i)
    })
})

describe('buildLayerFromFile', () => {
    const asFile = (name: string, content: string) =>
        new File([content], name, { type: 'application/json' })

    const fc = JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-111, 39] }, properties: {} }],
    })

    it('builds a local geojson layer from a FeatureCollection file', async () => {
        const layer = await buildLayerFromFile(asFile('my_sites.geojson', fc), 'upload-1')
        expect(layer.type).toBe('geojson')
        expect(layer.title).toBe('my_sites')
        expect(layer.idbKey).toBe('upload-1')
        expect(layer.userAdded).toBe(true)
        expect(layer.local).toBe(true)
        expect(layer.data?.features).toHaveLength(1)
    })

    it('rejects non-GeoJSON extensions', async () => {
        await expect(buildLayerFromFile(asFile('a.pmtiles', fc), 'k')).rejects.toThrow(/Only GeoJSON files/)
    })

    it('rejects invalid JSON', async () => {
        await expect(buildLayerFromFile(asFile('a.geojson', '{nope'), 'k')).rejects.toThrow(/not valid JSON/)
    })

    it('rejects JSON that is not a FeatureCollection', async () => {
        await expect(
            buildLayerFromFile(asFile('a.geojson', JSON.stringify({ type: 'Feature' })), 'k'),
        ).rejects.toThrow(/not a GeoJSON FeatureCollection/)
    })
})
