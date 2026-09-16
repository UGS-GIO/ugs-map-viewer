import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    fetchStacNode,
    detectStacItemFormat,
    isStacCatalogOrCollection,
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
