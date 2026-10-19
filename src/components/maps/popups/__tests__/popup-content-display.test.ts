import { describe, it, expect } from 'vitest'
import { buildGalleryImages, buildAccordionEntries } from '../popup-content-display'
import type { RelatedTable } from '@/lib/types/mapping-types'

const galleryTable: RelatedTable = {
    fieldLabel: 'Photos',
    matchingField: 'api',
    targetField: 'api',
    url: 'https://example.com/photos',
    headers: {},
    displayAs: 'gallery',
    galleryUrlField: 'medium_url',
    galleryThumbnailField: 'thumb_url',
    galleryLabelField: 'label',
    galleryMetadataFields: [
        { field: 'photo_type', label: 'Type' },
        { field: 'depth', label: 'Depth (ft)' },
        { field: 'notes', label: 'Notes' },
    ],
}

describe('buildGalleryImages', () => {
    it('returns empty array when no imageFields or relatedTables', () => {
        expect(buildGalleryImages(undefined, {}, undefined, [])).toEqual([])
    })

    it('builds images from relatedTable rows', () => {
        const rows = [{ api: '1', medium_url: 'https://img/1.jpg', thumb_url: 'https://img/1t.jpg', label: 'Box 1', photo_type: 'Core Box', depth: 100, notes: 'note' }]
        const result = buildGalleryImages(undefined, { api: '1' }, [galleryTable], [rows])
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('https://img/1.jpg')
        expect(result[0].thumbnailUrl).toBe('https://img/1t.jpg')
        expect(result[0].label).toBe('Box 1')
        expect(result[0].metadata).toEqual([
            { label: 'Type', value: 'Core Box' },
            { label: 'Depth (ft)', value: '100' },
            { label: 'Notes', value: 'note' },
        ])
    })

    it('filters out rows with missing url', () => {
        const rows = [
            { api: '1', medium_url: null, thumb_url: null, label: 'Box 1' },
            { api: '1', medium_url: 'https://img/2.jpg', thumb_url: null, label: 'Box 2' },
        ]
        const result = buildGalleryImages(undefined, { api: '1' }, [galleryTable], [rows])
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('https://img/2.jpg')
    })

    it('filters out null/empty metadata values', () => {
        const rows = [{ api: '1', medium_url: 'https://img/1.jpg', photo_type: 'Core Box', depth: null, notes: '' }]
        const result = buildGalleryImages(undefined, { api: '1' }, [galleryTable], [rows])
        expect(result[0].metadata).toEqual([{ label: 'Type', value: 'Core Box' }])
    })

    it('prepends galleryBaseUrl with encodeURIComponent', () => {
        const table: RelatedTable = { ...galleryTable, galleryBaseUrl: 'https://cdn.example.com' }
        const rows = [{ api: '1', medium_url: 'photo 1.jpg', thumb_url: 'thumb 1.jpg' }]
        const result = buildGalleryImages(undefined, { api: '1' }, [table], [rows])
        expect(result[0].url).toBe('https://cdn.example.com/photo%201.jpg')
        expect(result[0].thumbnailUrl).toBe('https://cdn.example.com/thumb%201.jpg')
    })

    it('omits thumbnailUrl when galleryThumbnailField is absent', () => {
        const table: RelatedTable = { ...galleryTable, galleryThumbnailField: undefined }
        const rows = [{ api: '1', medium_url: 'https://img/1.jpg' }]
        const result = buildGalleryImages(undefined, { api: '1' }, [table], [rows])
        expect(result[0].thumbnailUrl).toBeUndefined()
    })

    it('skips non-gallery relatedTables', () => {
        const listTable: RelatedTable = { ...galleryTable, displayAs: 'list' }
        const rows = [{ api: '1', medium_url: 'https://img/1.jpg' }]
        const result = buildGalleryImages(undefined, { api: '1' }, [listTable], [rows])
        expect(result).toHaveLength(0)
    })

    it('builds images from imageFields', () => {
        const result = buildGalleryImages(
            [{ field: 'photo_url', label: 'Site Photo', baseUrl: 'https://cdn.example.com' }],
            { photo_url: 'site.jpg' },
            undefined,
            []
        )
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('https://cdn.example.com/site.jpg')
        expect(result[0].label).toBe('Site Photo')
    })
})

// Core-docs accordion: well-level file attachments (reports, logs, lab results) shown as
// one collapsible item per document. Fixtures below are synthetic.
const docTable: RelatedTable = {
    fieldLabel: 'Documents',
    matchingField: 'uwi',
    targetField: 'uwi',
    url: 'https://example.com/docs',
    headers: {},
    displayAs: 'accordion',
    itemBaseUrl: 'https://ucrc-assets.geology.utah.gov',
}

describe('buildAccordionEntries', () => {
    it('returns [] for a non-accordion table', () => {
        const listTable: RelatedTable = { ...docTable, displayAs: 'list' }
        expect(buildAccordionEntries(listTable, [{ pk: 1, filename: 'a.pdf', storage_path: 'x/a.pdf' }])).toEqual([])
    })

    it('builds one item per doc: filename label + encoded CDN href, preserving path slashes', () => {
        const rows = [{
            pk: 1, filename: 'core report (1.0).pdf', notes: '',
            storage_path: 'docs/well-a/core report (1.0).pdf',
        }]
        const [item] = buildAccordionEntries(docTable, rows)
        expect(item.key).toBe('1')
        expect(item.label).toBe('core report (1.0).pdf')
        // spaces → %20, slashes preserved (encodeURI, not encodeURIComponent)
        expect(item.href).toBe('https://ucrc-assets.geology.utah.gov/docs/well-a/core%20report%20(1.0).pdf')
        expect(item.notes).toBeUndefined()
    })

    it('includes trimmed notes when present', () => {
        const rows = [{ pk: 2, filename: 'summary.xlsx', storage_path: 'docs/well-a/summary.xlsx', notes: '  a note  ' }]
        expect(buildAccordionEntries(docTable, rows)[0].notes).toBe('a note')
    })

    it('omits href when storage_path or itemBaseUrl is missing', () => {
        expect(buildAccordionEntries(docTable, [{ pk: 1, filename: 'a.pdf', storage_path: '' }])[0].href).toBeUndefined()
        const noBase: RelatedTable = { ...docTable, itemBaseUrl: undefined }
        expect(buildAccordionEntries(noBase, [{ pk: 1, filename: 'a.pdf', storage_path: 'x/a.pdf' }])[0].href).toBeUndefined()
    })
})
