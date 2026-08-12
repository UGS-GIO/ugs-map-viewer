import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchStacItem, fetchStacItemIndex, stacItemHref, type StacItem } from '../stac-layer'

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
