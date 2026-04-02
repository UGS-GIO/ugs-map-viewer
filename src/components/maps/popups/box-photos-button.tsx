import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { PopupImageGallery, type GalleryImage } from './popup-image-gallery'
import { PROD_POSTGREST_URL } from '@/lib/constants'

const UCRC_GCS_BASE_URL = 'https://ucrc-assets.geology.utah.gov'
const encodePathSegments = (p: string) => p.split('/').map(encodeURIComponent).join('/')
const buildThumbnailPath = (gcsPath: string) =>
    gcsPath.startsWith('photos/')
        ? `photos/_thumbs/200/${gcsPath.slice('photos/'.length)}`
        : `_thumbs/200/${gcsPath}`

type PhotoRow = {
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

export function BoxPhotosCell({ boxId }: { boxId: string }) {
    const [images, setImages] = useState<GalleryImage[] | null>(null)

    useEffect(() => {
        fetch(
            `${PROD_POSTGREST_URL}/enmin_ucrc_photos_django_test_current?box_pk=eq.${boxId}&order=top_depth.asc`,
            { headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' } }
        )
            .then(res => res.json())
            .then((rows: PhotoRow[]) => setImages(rows.map(toGalleryImage)))
            .catch(() => setImages([]))
    }, [boxId])

    if (images === null) return <Skeleton className="w-10 h-7 rounded-sm" />
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
