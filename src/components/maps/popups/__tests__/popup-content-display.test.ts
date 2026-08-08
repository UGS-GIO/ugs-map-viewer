import { describe, it, expect } from 'vitest'
import { buildGalleryImages } from '../popup-content-display'
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
