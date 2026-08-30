import { describe, it, expect } from 'vitest'
import { buildGalleryImages, buildCoreDocItems } from '../popup-content-display'
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
// one collapsible item per document. Fixtures below are real rows #209 would publish.
const docTable: RelatedTable = {
    fieldLabel: 'Core Docs',
    matchingField: 'uwi',
    targetField: 'uwi',
    url: 'https://example.com/docs',
    headers: {},
    displayAs: 'accordion',
    docBaseUrl: 'https://ucrc-assets.geology.utah.gov',
}

describe('buildCoreDocItems', () => {
    it('returns [] for a non-accordion table', () => {
        const listTable: RelatedTable = { ...docTable, displayAs: 'list' }
        expect(buildCoreDocItems(listTable, [{ pk: 1, filename: 'a.pdf', gcs_path: 'x/a.pdf' }])).toEqual([])
    })

    it('builds one item per doc: filename label + encoded CDN href, preserving path slashes', () => {
        const rows = [{
            pk: 11, filename: 'Rector 8X Completion Coregraph(1.0).pdf', notes: '',
            gcs_path: 'attachments/wells/05103070430000/Rector 8X Completion Coregraph(1.0).pdf',
        }]
        const [item] = buildCoreDocItems(docTable, rows)
        expect(item.key).toBe('11')
        expect(item.label).toBe('Rector 8X Completion Coregraph(1.0).pdf')
        // spaces → %20, slashes preserved (encodeURI, not encodeURIComponent)
        expect(item.href).toBe('https://ucrc-assets.geology.utah.gov/attachments/wells/05103070430000/Rector%208X%20Completion%20Coregraph(1.0).pdf')
        expect(item.notes).toBeUndefined()
    })

    it('includes trimmed notes when present', () => {
        const rows = [{ pk: 9, filename: 'summary.xlsx', gcs_path: 'x/summary.xlsx', notes: '  TESTING  ' }]
        expect(buildCoreDocItems(docTable, rows)[0].notes).toBe('TESTING')
    })

    it('omits href when gcs_path or docBaseUrl is missing', () => {
        expect(buildCoreDocItems(docTable, [{ pk: 1, filename: 'a.pdf', gcs_path: '' }])[0].href).toBeUndefined()
        const noBase: RelatedTable = { ...docTable, docBaseUrl: undefined }
        expect(buildCoreDocItems(noBase, [{ pk: 1, filename: 'a.pdf', gcs_path: 'x/a.pdf' }])[0].href).toBeUndefined()
    })
})
