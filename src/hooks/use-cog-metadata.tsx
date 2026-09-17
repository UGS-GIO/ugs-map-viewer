import { useQuery } from '@tanstack/react-query'
import { fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff'
import type { Polygon } from 'geojson'
import type { COGLayerProps } from '@/lib/types/mapping-types'
import { convertCoordinate } from '@/lib/map/conversion-utils'
import { queryKeys } from '@/lib/query-keys'
import { isRecord } from '@/lib/utils'

export interface CogMetadata {
    /** Band stats. Absent on RGB/palette images, which carry no meaningful stretch. */
    minimum?: number
    maximum?: number
    mean?: number
    stddev?: number
    /** True when the image draws as its own colours (RGB(A) or palette) instead of through a ramp. */
    rgb?: boolean
    /** [pixelW, pixelH] in COG's native CRS units (positive). undefined if not readable. */
    pixelSize?: [number, number]
    /** [x, y] of upper-left pixel origin in COG's native CRS. undefined if not readable. */
    origin?: [number, number]
    /** EPSG code of COG's native CRS (e.g. 3857). undefined if not readable. */
    epsg?: number
}

const STATIC_QUERY_OPTS = {
    staleTime: 1000 * 60 * 60,    // 1h — COG file is immutable during a session
    gcTime: 1000 * 60 * 60,       // keep in cache as long as it's fresh
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
} as const

/**
 * Reads pixel stats + grid info embedded in the COG via `gdal_edit -stats` (TIFF GDAL_METADATA tags).
 * Single source of truth — no STAC drift. Falls back to STAC URL if COG has no embedded stats.
 */
export function useCogMetadata(cogUrl?: string, stacFallbackUrl?: string) {
    return useQuery<CogMetadata | null>({
        queryKey: queryKeys.cog.metadata(cogUrl, stacFallbackUrl),
        enabled: !!cogUrl,
        ...STATIC_QUERY_OPTS,
        queryFn: () => loadCogMetadata(cogUrl!, stacFallbackUrl),
    })
}

/** Resolves a COG layer's render range from embedded stats / STAC. Returns undefined while loading, on fetch failure, or for RGB images. */
export function useCogRange(layer: COGLayerProps): [number, number] | undefined {
    const { data } = useCogMetadata(layer.cogUrl, layer.stacUrl)
    if (!data) return undefined
    return deriveRange(data, layer.stretchMode ?? 'minmax')
}

/** Null until the COG is readable; then a range for single-band data, or an empty result for RGB images that need no ramp. */
export function useCogRender(layer: COGLayerProps): { range: [number, number] | undefined } | null {
    const { data } = useCogMetadata(layer.cogUrl, layer.stacUrl)
    if (!data) return null
    return { range: deriveRange(data, layer.stretchMode ?? 'minmax') }
}

// Module-level cache so repeated fromUrl(cogUrl) calls share a parsed GeoTIFF instance
// (header range read happens once per URL across hook + non-hook callers).
const tiffCache = new Map<string, Promise<GeoTIFF>>()
function getTiff(cogUrl: string): Promise<GeoTIFF> {
    let p = tiffCache.get(cogUrl)
    if (!p) {
        p = fromUrl(cogUrl).catch(err => { tiffCache.delete(cogUrl); throw err })
        tiffCache.set(cogUrl, p)
    }
    return p
}

/** One-shot fetch of COG metadata. Exported so non-hook callers (e.g. popup zoom handler) can use it. */
export async function loadCogMetadata(cogUrl: string, stacFallbackUrl?: string): Promise<CogMetadata | null> {
    const fromCog = await readCogMetadata(cogUrl)
    if (fromCog) return fromCog
    if (stacFallbackUrl) return readStacStats(stacFallbackUrl)
    return null
}

function readNumber(md: Record<string, unknown>, key: string): number | undefined {
    const raw = md[key]
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN
    return Number.isFinite(n) ? n : undefined
}

/** Grid info — used to snap a click to the pixel cell for highlighting. */
function readGrid(image: GeoTIFFImage): Pick<CogMetadata, 'pixelSize' | 'origin' | 'epsg'> {
    try {
        const [px, py] = image.getResolution()
        const [ox, oy] = image.getOrigin()
        const keys: unknown = image.getGeoKeys()
        const code = isRecord(keys) ? keys.ProjectedCSTypeGeoKey ?? keys.GeographicTypeGeoKey : undefined
        return {
            pixelSize: [Math.abs(px), Math.abs(py)],
            origin: [ox, oy],
            epsg: typeof code === 'number' ? code : undefined,
        }
    } catch {
        return {}
    }
}

/** PhotometricInterpretation 2 = RGB, 3 = palette. Both render without a colour ramp. */
function isRgbImage(image: GeoTIFFImage): boolean {
    const photometric: unknown = isRecord(image.fileDirectory) ? image.fileDirectory.PhotometricInterpretation : undefined
    if (photometric === 2 || photometric === 3) return true
    return image.getSamplesPerPixel() >= 3
}

async function readCogMetadata(cogUrl: string): Promise<CogMetadata | null> {
    try {
        const tiff = await getTiff(cogUrl)
        const image = await tiff.getImage(0)
        const grid = readGrid(image)
        const raw: unknown = image.getGDALMetadata(0)
        const md = isRecord(raw) ? raw : {}
        const minimum = readNumber(md, 'STATISTICS_MINIMUM')
        const maximum = readNumber(md, 'STATISTICS_MAXIMUM')
        const mean = readNumber(md, 'STATISTICS_MEAN')
        const stddev = readNumber(md, 'STATISTICS_STDDEV')
        // Scanned maps ship as RGB with no stats; they are still renderable, so they
        // must not fall through to the STAC lookup and then to "unreadable".
        if (minimum === undefined || maximum === undefined || mean === undefined || stddev === undefined) {
            return isRgbImage(image) ? { rgb: true, ...grid } : null
        }
        return { minimum, maximum, mean, stddev, ...grid }
    } catch {
        return null
    }
}

interface StacItem {
    assets?: Record<string, { 'raster:bands'?: Array<{ statistics?: Partial<CogMetadata> }> }>
}

async function readStacStats(stacUrl: string): Promise<CogMetadata | null> {
    const res = await fetch(stacUrl)
    if (!res.ok) return null
    const item: StacItem = await res.json()
    const asset = item.assets ? Object.values(item.assets)[0] : undefined
    const s = asset?.['raster:bands']?.[0]?.statistics
    if (!s || s.minimum === undefined || s.maximum === undefined ||
        s.mean === undefined || s.stddev === undefined) return null
    return { minimum: s.minimum, maximum: s.maximum, mean: s.mean, stddev: s.stddev }
}

/** Undefined when the image carries no stats to stretch (RGB scans). */
export function deriveRange(stats: CogMetadata, mode: 'minmax' | 'sigma'): [number, number] | undefined {
    const { minimum, maximum, mean, stddev } = stats
    if (mode === 'sigma' && mean !== undefined && stddev !== undefined) return [mean - 2 * stddev, mean + 2 * stddev]
    if (minimum === undefined || maximum === undefined) return undefined
    return [minimum, maximum]
}

/**
 * Snap a click point to the COG pixel grid and return the cell as a WGS84 polygon.
 * Returns null if metadata lacks pixelSize/origin.
 */
export function computeCogPixelPolygon(
    clickPoint: { lng: number; lat: number },
    metadata: CogMetadata,
): Polygon | null {
    if (!metadata.pixelSize || !metadata.origin) return null
    const cogEpsg = `EPSG:${metadata.epsg ?? 3857}`
    const [pxW, pxH] = metadata.pixelSize
    const [originX, originY] = metadata.origin

    const [cx, cy] = convertCoordinate([clickPoint.lng, clickPoint.lat], 'EPSG:4326', cogEpsg)
    const col = Math.floor((cx - originX) / pxW)
    const row = Math.floor((originY - cy) / pxH)
    const minX = originX + col * pxW
    const maxX = minX + pxW
    const maxY = originY - row * pxH
    const minY = maxY - pxH

    const ll = convertCoordinate([minX, minY], cogEpsg, 'EPSG:4326')
    const lr = convertCoordinate([maxX, minY], cogEpsg, 'EPSG:4326')
    const ur = convertCoordinate([maxX, maxY], cogEpsg, 'EPSG:4326')
    const ul = convertCoordinate([minX, maxY], cogEpsg, 'EPSG:4326')

    return { type: 'Polygon', coordinates: [[ll, lr, ur, ul, ll]] }
}
