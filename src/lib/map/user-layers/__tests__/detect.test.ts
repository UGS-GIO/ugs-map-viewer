import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectFormatFromUrl, titleFromUrl, colorFromTitle, buildLayerFromFile, buildLayerFromUrl } from '../detect'
import { loadCogMetadata } from '@/hooks/use-cog-metadata'
import { registerLocalPMTiles } from '@/lib/map/pmtiles/setup'
import type { GeoJSONLayerProps, PMTilesLayerProps, COGLayerProps } from '@/lib/types/mapping-types'

vi.mock('@/hooks/use-cog-metadata', () => ({ loadCogMetadata: vi.fn() }))
vi.mock('@/lib/map/pmtiles/setup', () => ({ registerLocalPMTiles: vi.fn() }))

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
        const { def } = await buildLayerFromFile(asFile('my_sites.geojson', fc), 'upload-1')
        expect(def.type).toBe('geojson')
        expect(def.title).toBe('my_sites')
        expect(def.idbKey).toBe('upload-1')
        expect(def.userAdded).toBe(true)
        expect(def.local).toBe(true)
        expect((def as GeoJSONLayerProps).data?.features).toHaveLength(1)
    })

    it('rejects unsupported extensions', async () => {
        await expect(buildLayerFromFile(asFile('a.csv', fc), 'k')).rejects.toThrow(/Only GeoJSON .* PMTiles .* COG/)
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

describe('buildLayerFromFile — COG uploads', () => {
    const tifFile = (name = 'gravity.tif') =>
        new File([new Uint8Array([1, 2, 3])], name, { type: 'image/tiff' })

    beforeEach(() => {
        vi.mocked(loadCogMetadata).mockReset()
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:http://localhost/fake-object-url'),
            revokeObjectURL: vi.fn(),
        })
    })

    it('builds a local COG layer pointed at an object URL', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 25.37, maximum: 74.2, mean: 49.62, stddev: 11.96 })
        const { def, file } = await buildLayerFromFile(tifFile(), 'upload-cog')
        const layer = def as COGLayerProps

        expect(layer.type).toBe('cog')
        expect(layer.title).toBe('gravity')
        expect(layer.cogUrl).toBe('blob:http://localhost/fake-object-url')
        expect(layer.local).toBe(true)
        expect(layer.userAdded).toBe(true)
        expect(layer.idbKey).toBe('upload-cog')
        expect(file.name).toBe('gravity.tif') // the original file is what gets persisted
    })

    it('rejects a COG with no stats and releases the object URL', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue(null)
        await expect(buildLayerFromFile(tifFile(), 'k')).rejects.toThrow(/no readable statistics/)
        // Must not leak the object URL for a layer that was never added.
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-object-url')
    })

    it('rejects an unreadable tiff rather than propagating the raw error', async () => {
        vi.mocked(loadCogMetadata).mockRejectedValue(new Error('not a tiff'))
        await expect(buildLayerFromFile(tifFile(), 'k')).rejects.toThrow(/no readable statistics/)
    })

    it('accepts .tiff as well as .tif', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 0, maximum: 1, mean: 0.5, stddev: 0.1 })
        const { def } = await buildLayerFromFile(tifFile('dem.tiff'), 'k')
        expect(def.type).toBe('cog')
        expect(def.title).toBe('dem')
    })

    // The cog protocol assumes Web Mercator; another CRS renders nowhere, silently.
    it('rejects a COG that is not EPSG:3857', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 0, maximum: 1, mean: 0.5, stddev: 0.1, epsg: 4326 })
        await expect(buildLayerFromFile(tifFile(), 'k')).rejects.toThrow(/EPSG:4326, but COG layers must be EPSG:3857/)
        expect(URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('accepts an EPSG:3857 COG', async () => {
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 0, maximum: 1, mean: 0.5, stddev: 0.1, epsg: 3857 })
        const { def } = await buildLayerFromFile(tifFile(), 'k')
        expect(def.type).toBe('cog')
    })

    it('does not reject when the CRS simply could not be read', async () => {
        // epsg undefined => unknown, not wrong. Blocking here would be a false reject.
        vi.mocked(loadCogMetadata).mockResolvedValue({ minimum: 0, maximum: 1, mean: 0.5, stddev: 0.1 })
        const { def } = await buildLayerFromFile(tifFile(), 'k')
        expect(def.type).toBe('cog')
    })
})

describe('buildLayerFromFile — PMTiles uploads', () => {
    const pmtilesFile = (name = 'tiles.pmtiles') =>
        new File([new Uint8Array([1, 2, 3])], name, { type: 'application/vnd.pmtiles' })

    beforeEach(() => vi.mocked(registerLocalPMTiles).mockReset())

    /** Stand-in for the PMTiles instance registerLocalPMTiles returns. */
    const mockArchive = (metadata: unknown) =>
        vi.mocked(registerLocalPMTiles).mockReturnValue({
            getMetadata: () => Promise.resolve(metadata),
        } as unknown as ReturnType<typeof registerLocalPMTiles>)

    it('builds a local PMTiles layer keyed by the registered file name', async () => {
        mockArchive({ vector_layers: [{ id: 'quaternary_faults' }] })
        const { def, file } = await buildLayerFromFile(pmtilesFile(), 'upload-abc')
        const layer = def as PMTilesLayerProps

        expect(layer.type).toBe('pmtiles')
        expect(layer.title).toBe('tiles')             // display title keeps the original name
        expect(layer.sourceLayer).toBe('quaternary_faults')
        expect(layer.local).toBe(true)
        expect(layer.userAdded).toBe(true)
        // pmtilesUrl is the protocol KEY and must equal the registered file's name,
        // or the protocol would miss and fetch it as a URL.
        expect(layer.pmtilesUrl).toBe('upload-abc-tiles.pmtiles')
        expect(file.name).toBe(layer.pmtilesUrl)
        expect(vi.mocked(registerLocalPMTiles).mock.calls[0][0].name).toBe('upload-abc-tiles.pmtiles')
    })

    it('gives same-named uploads distinct protocol keys so they cannot collide', async () => {
        mockArchive({ vector_layers: [{ id: 'l' }] })
        const a = await buildLayerFromFile(pmtilesFile(), 'upload-1')
        const b = await buildLayerFromFile(pmtilesFile(), 'upload-2')
        expect((a.def as PMTilesLayerProps).pmtilesUrl).not.toBe((b.def as PMTilesLayerProps).pmtilesUrl)
    })

    it('synthesizes a default style so an archive with no STAC render still draws', async () => {
        mockArchive({ vector_layers: [{ id: 'roads' }] })
        const { def } = await buildLayerFromFile(pmtilesFile(), 'k')
        const styleUrl = (def as PMTilesLayerProps).styleUrl!
        expect(styleUrl.startsWith('data:application/json,')).toBe(true)
        const fragment = JSON.parse(decodeURIComponent(styleUrl.replace('data:application/json,', '')))
        expect(fragment.layers.map((l: { type: string }) => l.type)).toEqual(['fill', 'line', 'circle'])
        expect(fragment.layers.every((l: Record<string, string>) => l['source-layer'] === 'roads')).toBe(true)
    })

    it('rejects a raster-only archive (no vector layers)', async () => {
        mockArchive({ vector_layers: [] })
        await expect(buildLayerFromFile(pmtilesFile(), 'k')).rejects.toThrow(/no vector layers/)
    })

    it('rejects a file that is not a readable PMTiles archive', async () => {
        vi.mocked(registerLocalPMTiles).mockReturnValue({
            getMetadata: () => Promise.reject(new Error('bad magic number')),
        } as unknown as ReturnType<typeof registerLocalPMTiles>)
        await expect(buildLayerFromFile(pmtilesFile(), 'k')).rejects.toThrow(/could not be read as a PMTiles archive/)
    })
})
