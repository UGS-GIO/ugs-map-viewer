import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    fetchStacNode,
    detectStacItemFormat,
    isStacCatalogOrCollection,
    mappableItems,
    mappableChildren,
    type StacItemSummary,
} from '@/lib/map/user-layers/stac-explorer'

describe('detectStacItemFormat', () => {
    it('detects PMTiles asset', () => {
        expect(
            detectStacItemFormat({
                assets: {
                    pmtiles: { type: 'application/vnd.pmtiles', href: 'https://x.org/a.pmtiles' },
                },
            }),
        ).toBe('pmtiles')
    })

    it('detects COG asset', () => {
        expect(
            detectStacItemFormat({
                assets: {
                    visual: { type: 'image/tiff; application=geotiff', href: 'https://x.org/a.tif' },
                },
            }),
        ).toBe('cog')
    })

    it('detects GeoJSON asset', () => {
        expect(
            detectStacItemFormat({
                assets: {
                    data: { type: 'application/geo+json', href: 'https://x.org/a.geojson' },
                },
            }),
        ).toBe('geojson')
    })
})

describe('fetchStacNode', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('identifies and parses a STAC Catalog with children', async () => {
        const mockCatalog = {
            type: 'Catalog',
            id: 'ugs-warehouse',
            title: 'UGS Data Warehouse',
            description: 'Warehouse catalog',
            links: [
                { rel: 'child', href: './serving-topics/catalog.json', title: 'Serving Topics', 'ugs:item_count': 56 },
                { rel: 'child', href: './rasters/catalog.json', title: 'Rasters', 'ugs:item_count': 2 },
            ],
        }

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockCatalog),
        }))

        const node = await fetchStacNode('https://maps-assets.geology.utah.gov/warehouse/stac/catalog.json')
        expect(isStacCatalogOrCollection(node)).toBe(true)
        if (isStacCatalogOrCollection(node)) {
            expect(node.kind).toBe('catalog')
            expect(node.title).toBe('UGS Data Warehouse')
            expect(node.children).toHaveLength(2)
            expect(node.children[0].title).toBe('Serving Topics')
            expect(node.children[0].href).toBe('https://maps-assets.geology.utah.gov/warehouse/stac/serving-topics/catalog.json')
            expect(node.children[0].itemCount).toBe(56)
        }
    })

    it('fetches ugs-items-index when present in a collection', async () => {
        const mockCollection = {
            type: 'Collection',
            id: 'serving-topics',
            title: 'Serving Topics',
            links: [
                { rel: 'ugs-items-index', href: './items.json' },
            ],
        }

        const mockItemsIndex = {
            items: [
                {
                    id: 'enmin_ucrc_wells',
                    properties: { title: 'UCRC Wells' },
                    assets: { pmtiles: { type: 'application/vnd.pmtiles', href: 'https://x.org/wells.pmtiles' } },
                    links: [{ rel: 'self', href: './emp/enmin_ucrc_wells/enmin_ucrc_wells.json' }],
                },
            ],
        }

        vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
            if (url.endsWith('items.json')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockItemsIndex) })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCollection) })
        }))

        const node = await fetchStacNode('https://maps-assets.geology.utah.gov/warehouse/stac/serving-topics/catalog.json')
        expect(isStacCatalogOrCollection(node)).toBe(true)
        if (isStacCatalogOrCollection(node)) {
            expect(node.items).toHaveLength(1)
            expect(node.items[0].id).toBe('enmin_ucrc_wells')
            expect(node.items[0].title).toBe('UCRC Wells')
            expect(node.items[0].format).toBe('pmtiles')
            expect(node.items[0].href).toBe('https://maps-assets.geology.utah.gov/warehouse/stac/serving-topics/emp/enmin_ucrc_wells/enmin_ucrc_wells.json')
        }
    })

    it('identifies an Item node when renderable assets are present', async () => {
        const mockItem = {
            type: 'Feature',
            id: 'fort_douglas_ofr',
            properties: { title: 'Fort Douglas Quadrangle' },
            assets: {
                visual: { type: 'image/tiff; application=geotiff', href: 'https://x.org/fd_3857.cog.tif' },
            },
        }

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockItem),
        }))

        const node = await fetchStacNode('https://maps-assets.geology.utah.gov/warehouse/stac/item.json')
        expect(node.kind).toBe('item')
        expect(node.id).toBe('fort_douglas_ofr')
        expect(node.title).toBe('Fort Douglas Quadrangle')
    })
})

describe('what the catalog browser offers', () => {
    const item = (format: string) => ({ id: format, title: format, href: 'x', format }) as StacItemSummary

    it('keeps items with a drawable asset and drops the rest', () => {
        const kept = mappableItems([item('pmtiles'), item('cog'), item('geojson'), item('parquet'), item('other')])
        expect(kept.map(i => i.format)).toEqual(['pmtiles', 'cog', 'geojson', 'parquet'])
    })

    it('recognizes a geoparquet-only item, which would otherwise read as non-spatial', () => {
        expect(detectStacItemFormat({ assets: { data: { href: 'https://x.org/a.parquet' } } })).toBe('parquet')
        expect(detectStacItemFormat({ assets: { data: { type: 'application/vnd.apache.parquet' } } })).toBe('parquet')
    })

    it('treats a document-only item as non-spatial', () => {
        expect(detectStacItemFormat({ assets: { report: { type: 'application/pdf', href: 'r.pdf' } } })).toBe('other')
    })

    it('hides a catalog with nothing mappable in it', () => {
        // Mining District Files: 4,212 items, none of them spatial.
        const children = [
            { title: 'Serving Topics', href: 'a', itemCount: 56, mappableCount: 56 },
            { title: 'Publications', href: 'b', itemCount: 3101, mappableCount: 850 },
            { title: 'Mining District Files', href: 'c', itemCount: 4212, mappableCount: 0 },
        ]
        expect(mappableChildren(children).map(c => c.title)).toEqual(['Serving Topics', 'Publications'])
    })

    it('keeps a catalog that never declared a count — unknown is not zero', () => {
        const children: Array<{ title: string; href: string; mappableCount?: number }> = [
            { title: 'USWB', href: 'd' },
        ]
        expect(mappableChildren(children)).toHaveLength(1)
    })
})
