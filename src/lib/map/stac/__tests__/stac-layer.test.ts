import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchStacItem, fetchStacItemIndex, resolveStacLayerTree, stacItemHref, type StacItem } from '../stac-layer'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'

const entry: StacItem = {
    id: 'enmin_ucrc_wells',
    properties: { 'ugs:dbt_schema': 'emp' },
    // What the rollup index actually carries: no ugs:foreign_keys, no table:columns.
    assets: { enmin_ucrc_boxes: { href: 'https://x/boxes.parquet', roles: ['data', 'related'] } },
    partial: true,
}

const fullItem = {
    id: 'enmin_ucrc_wells',
    properties: { 'ugs:dbt_schema': 'emp' },
    assets: {
        enmin_ucrc_boxes: {
            href: 'https://x/boxes.parquet',
            roles: ['data', 'related'],
            'ugs:foreign_keys': [{ fields: ['uwi'], reference: { resource: 'enmin_ucrc_wells', fields: ['uwi'] } }],
            'table:columns': [{ name: 'uwi' }, { name: 'box_number' }],
        },
    },
}

const mockFetch = (impl: (url: string) => Partial<Response>) =>
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(impl(url) as Response)))

afterEach(() => vi.unstubAllGlobals())

describe('stacItemHref', () => {
    it('nests the item under its dbt schema', () => {
        expect(stacItemHref(entry)).toBe(
            'https://maps-assets.geology.utah.gov/warehouse/stac/ugs-serving-topics/emp/enmin_ucrc_wells/enmin_ucrc_wells.json',
        )
    })

    it('returns undefined without a schema to nest under', () => {
        expect(stacItemHref({ ...entry, properties: {} })).toBeUndefined()
    })
})

describe('fetchStacItemIndex', () => {
    it('flags entries partial — the index trims asset metadata', async () => {
        mockFetch(() => ({ ok: true, json: () => Promise.resolve({ items: [entry] }) }))
        const index = await fetchStacItemIndex()
        expect(index.enmin_ucrc_wells.partial).toBe(true)
    })
})

describe('fetchStacItem', () => {
    it('hydrates join metadata the index entry lacks', async () => {
        expect(entry.assets.enmin_ucrc_boxes['ugs:foreign_keys']).toBeUndefined()
        mockFetch(() => ({ ok: true, json: () => Promise.resolve(fullItem) }))

        const item = await fetchStacItem(entry)

        expect(item.partial).toBe(false)
        expect(item.assets.enmin_ucrc_boxes['ugs:foreign_keys']?.[0].fields).toEqual(['uwi'])
        expect(item.assets.enmin_ucrc_boxes['table:columns']).toHaveLength(2)
    })

    it('falls back to the still-partial entry when the full item is unreachable', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => { })
        mockFetch(() => ({ ok: false, status: 404 }))

        // Layer keeps rendering from the index's pmtiles/renders; only related tables drop.
        expect(await fetchStacItem(entry)).toEqual(entry)
        expect(err).toHaveBeenCalled()
        err.mockRestore()
    })

    it('does not fetch when the entry has no schema to derive an href from', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => { })
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const noSchema = { ...entry, properties: {} }
        expect(await fetchStacItem(noSchema)).toEqual(noSchema)
        expect(fetchSpy).not.toHaveBeenCalled()
        err.mockRestore()
    })
})

describe('resolveStacLayerTree sourceAgency precedence', () => {
    it('preserves app-authored sourceAgency over STAC point_of_contact', async () => {
        const stacDoc = {
            id: 'enmin_ccs_wells_formation',
            properties: {
                'ugs:dbt_schema': 'emp',
                'ugs:point_of_contact': 'Utah Geological Survey',
            },
            assets: {
                pmtiles: { href: 'https://x/wells.pmtiles', type: 'application/vnd.pmtiles' },
            },
        }
        mockFetch((url) => ({
            ok: true,
            json: () => Promise.resolve(url.endsWith('items.json') ? { items: [stacDoc] } : stacDoc),
        }))

        const layer: PMTilesLayerProps = {
            type: 'pmtiles',
            stacItemId: 'enmin_ccs_wells_formation',
            pmtilesUrl: '',
            sourceLayer: 'enmin_ccs_wells_formation',
            title: 'Wells Database',
            sourceAgency: 'Utah Division of Oil, Gas and Mining',
        }
        const [resolved] = await resolveStacLayerTree([layer]) as PMTilesLayerProps[]
        expect(resolved.sourceAgency).toBe('Utah Division of Oil, Gas and Mining')
        expect(resolved.subtitle).toBeUndefined()
    })

    it('resolves stacItemUrl directly using pmtiles:layers[0] and keeps missing fallback renders', async () => {
        const pubUrl = 'https://maps-assets.geology.utah.gov/warehouse/stac/ugs-publications/M/M-179DM/M-179DM__Geology_arc/M-179DM__Geology_arc.json'
        const pubDoc = {
            id: 'M-179DM__Geology_arc',
            properties: {
                'proj:code': 'EPSG:26712',
                'ugs:renders': {
                    default: { title: 'Publication layer style', assets: ['pmtiles'], style_url: 'https://x/default.json' },
                },
            },
            assets: {
                pmtiles: { href: 'https://x/Geology_arc.pmtiles', type: 'application/vnd.pmtiles' },
                data: { href: 'https://x/Geology_arc.parquet', type: 'application/vnd.apache.parquet' },
            },
            links: [
                { rel: 'pmtiles', href: 'https://x/Geology_arc.pmtiles', 'pmtiles:layers': ['Geology_arc'] },
            ],
        }
        const fetchSpy = vi.fn((url: string) => Promise.resolve({
            ok: url === pubUrl,
            json: () => Promise.resolve(pubDoc),
        } as Response))
        vi.stubGlobal('fetch', fetchSpy)

        const layer: PMTilesLayerProps = {
            type: 'pmtiles',
            stacItemUrl: pubUrl,
            defaultRenderId: 'faults',
            pmtilesUrl: '',
            sourceLayer: '',
            downloadParquetUrl: '',
            title: 'Utah Faults',
            renders: [{ id: 'faults', styleUrl: 'https://x/faults.json' }],
        }
        const [resolved] = await resolveStacLayerTree([layer]) as PMTilesLayerProps[]
        expect(fetchSpy).toHaveBeenCalledTimes(1)
        expect(fetchSpy).toHaveBeenCalledWith(pubUrl)
        expect(resolved.pmtilesUrl).toBe('https://x/Geology_arc.pmtiles')
        expect(resolved.sourceLayer).toBe('Geology_arc')
        expect(resolved.downloadParquetUrl).toBe('')
        expect(resolved.downloadSourceCrs).toBe('EPSG:26712')
        expect(resolved.renders?.map(r => r.id)).toEqual(['default', 'faults'])
    })
})
