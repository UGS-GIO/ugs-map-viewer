import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { PopupImageGallery, type GalleryImage } from './popup-image-gallery'
import { PROD_POSTGREST_URL } from '@/lib/constants'
import { encodePathSegments } from '@/lib/gallery-utils'

const UCRC_GCS_BASE_URL = 'https://ucrc-assets.geology.utah.gov'
const buildThumbnailPath = (gcsPath: string) =>
    gcsPath.startsWith('photos/')
        ? `photos/_thumbs/200/${gcsPath.slice('photos/'.length)}`
        : `_thumbs/200/${gcsPath}`

type PhotoRow = {
    box_pk: number
    gcs_path: string
    filename?: string
    photo_type?: string
    top_depth?: number | null
    bottom_depth?: number | null
}

function toGalleryImage(row: PhotoRow): GalleryImage {
    return {
        url: `${UCRC_GCS_BASE_URL}/${encodePathSegments(row.gcs_path)}`,
        thumbnailUrl: `${UCRC_GCS_BASE_URL}/${encodePathSegments(buildThumbnailPath(row.gcs_path))}`,
        label: row.filename,
        metadata: [
            ...(row.photo_type ? [{ label: 'Type', value: row.photo_type }] : []),
            ...(row.top_depth != null ? [{ label: 'Top (ft)', value: String(row.top_depth) }] : []),
            ...(row.bottom_depth != null ? [{ label: 'Bottom (ft)', value: String(row.bottom_depth) }] : []),
        ],
    }
}

const fetchBoxPhotosBulk = async (boxIds: string[]): Promise<Map<string, GalleryImage[]>> => {
    const map = new Map<string, GalleryImage[]>()
    if (boxIds.length === 0) return map
    const inList = boxIds.join(',')
    const res = await fetch(
        `${PROD_POSTGREST_URL}/enmin_ucrc_photos_django_test_current?box_pk=in.(${inList})&order=top_depth.asc`,
        { headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' } },
    )
    if (!res.ok) return map
    const rows: PhotoRow[] = await res.json()
    for (const row of rows) {
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
export function BoxPhotosCell({ boxId, allBoxIds }: { boxId: string; allBoxIds: string[] }) {
    // Sorted key so sibling cells share one query regardless of row order
    const sortedKey = [...allBoxIds].sort().join(',')

    const { data: photoMap, isLoading } = useQuery({
        queryKey: ['ucrc-box-photos-bulk', sortedKey],
        queryFn: () => fetchBoxPhotosBulk(allBoxIds),
        staleTime: 1000 * 60 * 30,
        enabled: allBoxIds.length > 0,
    })

    if (isLoading) return <Skeleton className="w-10 h-7 rounded-sm" />

    const images = photoMap?.get(boxId) ?? []
    if (images.length === 0) return <span className="text-muted-foreground">—</span>

    const thumb = images[0].thumbnailUrl ?? images[0].url
    return (
        <PopupImageGallery
            images={images}
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
