import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectFormatFromUrl, titleFromUrl, colorFromTitle, buildLayerFromFile, buildLayerFromUrl } from '../detect'
import { loadCogMetadata } from '@/hooks/use-cog-metadata'

vi.mock('@/hooks/use-cog-metadata', () => ({ loadCogMetadata: vi.fn() }))

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

describe('buildLayerFromUrl — COG', () => {
    beforeEach(() => vi.mocked(loadCogMetadata).mockReset())

    it('builds a COG layer when the file has readable stats', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 0, maximum: 10, mean: 5, stddev: 1 })
        const layer = await buildLayerFromUrl('https://x.org/gravity.tif')
        expect(layer.type).toBe('cog')
        expect(layer.title).toBe('gravity')
        expect(layer.userAdded).toBe(true)
    })

    it('rejects a COG with no stats rather than adding a layer that renders blank', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue(null)
        await expect(buildLayerFromUrl('https://x.org/gravity.tif')).rejects.toThrow(/no readable statistics/)
    })
})

describe('buildLayerFromUrl — unsupported', () => {
    it('rejects an unrecognized format with a helpful message', async () => {
        await expect(buildLayerFromUrl('https://x.org/data.csv')).rejects.toThrow(/Could not detect format/)
    })

    it('rejects empty input', async () => {
        await expect(buildLayerFromUrl('   ')).rejects.toThrow(/Enter a URL or STAC item id/)
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
