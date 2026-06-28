import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { PopupImageGallery, type GalleryImage } from './popup-image-gallery'
import { UCRC_ASSETS_CDN_URL } from '@/lib/constants'
import { encodePathSegments } from '@/lib/gallery-utils'
import { sanitizeFilename } from '@/lib/download-utils'
import { fetchStacAssetHref } from '@/lib/map/stac/stac-layer'

const buildThumbnailPath = (gcsPath: string) =>
    gcsPath.startsWith('photos/')
        ? `photos/_thumbs/200/${gcsPath.slice('photos/'.length)}`
        : `_thumbs/200/${gcsPath}`

type PhotoRow = {
    box_pk: number
    storage_path: string
    filename?: string
    photo_type?: string
    top_depth?: number | null
    bottom_depth?: number | null
}

function toGalleryImage(row: PhotoRow): GalleryImage {
    return {
        url: `${UCRC_ASSETS_CDN_URL}/${encodePathSegments(row.storage_path)}`,
        thumbnailUrl: `${UCRC_ASSETS_CDN_URL}/${encodePathSegments(buildThumbnailPath(row.storage_path))}`,
        label: row.filename,
        metadata: [
            ...(row.photo_type ? [{ label: 'Type', value: row.photo_type }] : []),
            ...(row.top_depth != null ? [{ label: 'Top (ft)', value: String(row.top_depth) }] : []),
            ...(row.bottom_depth != null ? [{ label: 'Bottom (ft)', value: String(row.bottom_depth) }] : []),
        ],
    }
}

const fetchBoxPhotosBulk = async (boxIds: string[], parquetUrl: string): Promise<Map<string, GalleryImage[]>> => {
    const map = new Map<string, GalleryImage[]>()
    if (boxIds.length === 0 || !parquetUrl) return map
    // Read the STAC photos geoparquet, filtered by box_pk, via duckdb-wasm (lazy import
    // keeps duckdb off the initial bundle). Same asset the Core Photos gallery uses.
    const { queryParquetByValues } = await import('@/lib/duckdb/client')
    const rows = await queryParquetByValues({
        url: parquetUrl,
        matchingField: 'box_pk',
        values: boxIds,
        sortBy: 'top_depth',
        sortDirection: 'asc',
    })
    for (const row of rows as unknown as PhotoRow[]) {
        const key = String(row.box_pk)
        const list = map.get(key) ?? []
        list.push(toGalleryImage(row))
        map.set(key, list)
    }
    return map
}

/**
 * Renders the photo thumbnail/gallery for a single box. All instances mounted
 * with the same `allBoxIds` share one bulk fetch via react-query dedup.
 */
export function BoxPhotosCell({ boxId, allBoxIds, boxLabel, stacItemId = 'enmin_ucrc_wells', photosAsset = 'enmin_ucrc_photos' }: { boxId: string; allBoxIds: string[]; boxLabel?: string; stacItemId?: string; photosAsset?: string }) {
    // Resolve the photos geoparquet href from STAC (cached forever — immutable warehouse asset).
    const { data: parquetUrl, isLoading: urlLoading } = useQuery({
        queryKey: ['stac-asset-href', stacItemId, photosAsset],
        queryFn: () => fetchStacAssetHref(stacItemId, photosAsset),
        staleTime: Infinity,
    })

    // Sorted key so sibling cells share one query regardless of row order
    const sortedKey = [...allBoxIds].sort().join(',')

    const { data: photoMap, isLoading: photosLoading } = useQuery({
        queryKey: ['ucrc-box-photos-parquet', parquetUrl, sortedKey],
        queryFn: () => fetchBoxPhotosBulk(allBoxIds, parquetUrl!),
        staleTime: 1000 * 60 * 30,
        enabled: allBoxIds.length > 0 && !!parquetUrl,
    })

    if (urlLoading || photosLoading) return <Skeleton className="w-10 h-7 rounded-sm" />

    const images = photoMap?.get(boxId) ?? []
    if (images.length === 0) return <span className="text-muted-foreground">—</span>

    const thumb = images[0].thumbnailUrl ?? images[0].url
    return (
        <PopupImageGallery
            images={images}
            downloadName={`${sanitizeFilename(boxLabel ?? `box-${boxId}`)}-photos.zip`}
            trigger={
                <div className="relative w-10 h-7">
                    <img src={thumb} alt="box photos" className="w-full h-full object-cover rounded-sm border border-border" />
                    {images.length > 1 && (
                        <div className="absolute bottom-0 right-0 bg-black/60 rounded-sm px-0.5 leading-none">
                            <span className="text-white text-[9px] font-medium">{images.length}</span>
                        </div>
                    )}
                </div>
            }
        />
    )
}
