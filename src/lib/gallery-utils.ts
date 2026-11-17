import type { RelatedTable } from '@/lib/types/mapping-types'
import type { GalleryImage } from '@/components/maps/popups/popup-image-gallery'

/** URL-encode each path segment so slashes are preserved. */
export const encodePathSegments = (p: string): string =>
    p.split('/').map(encodeURIComponent).join('/')

/** Build a fully qualified URL by joining an optional base with an (already encoded) path. */
const joinBaseAndPath = (base: string | undefined, path: string): string => {
    if (!base || path.startsWith('http://') || path.startsWith('https://')) return path
    return `${base}/${encodePathSegments(path)}`
}

/**
 * Convert a related-table row into a GalleryImage using the table's gallery* config fields.
 * Returns null if the row has no gallery URL.
 */
export function relatedRowToGalleryImage(
    row: Record<string, unknown>,
    table: RelatedTable,
): GalleryImage | null {
    if (!table.galleryUrlField) return null
    const rawUrl = row[table.galleryUrlField]
    if (!rawUrl) return null
    const urlStr = String(rawUrl)
    const baseUrl = table.galleryBaseUrl ?? (typeof row.bucket_url === 'string' ? row.bucket_url : undefined)
    const url = joinBaseAndPath(baseUrl, urlStr)

    const rawThumb = table.galleryThumbnailTransform
        ? table.galleryThumbnailTransform(urlStr)
        : table.galleryThumbnailField
            ? String(row[table.galleryThumbnailField] ?? '')
            : undefined
    const thumbnailUrl = rawThumb ? joinBaseAndPath(baseUrl, rawThumb) : undefined

    const label = table.galleryLabelField ? String(row[table.galleryLabelField] ?? '') : undefined

    const metadata = table.galleryMetadataFields?.flatMap(({ field, label: metaLabel }) => {
        const val = row[field]
        if (val == null || val === '') return []
        return [{ label: metaLabel, value: String(val) }]
    })

    return { url, thumbnailUrl, label, metadata }
}
