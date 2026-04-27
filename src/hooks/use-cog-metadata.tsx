import { useQuery } from '@tanstack/react-query'
import { fromUrl, GeoTIFF } from 'geotiff'
import type { Polygon } from 'geojson'
import type { COGLayerProps } from '@/lib/types/mapping-types'
import { convertCoordinate } from '@/lib/map/conversion-utils'
import { queryKeys } from '@/lib/query-keys'

export interface CogMetadata {
    minimum: number
    maximum: number
    mean: number
    stddev: number
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

/** Resolves a COG layer's render range — dynamic from metadata when stretchMode set, else static fallback. */
export function useCogRange(layer: COGLayerProps): [number, number] {
    const { data } = useCogMetadata(layer.stretchMode ? layer.cogUrl : undefined, layer.stacUrl)
    return (layer.stretchMode && data) ? deriveRange(data, layer.stretchMode) : layer.range
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

async function readCogMetadata(cogUrl: string): Promise<CogMetadata | null> {
    try {
        const tiff = await getTiff(cogUrl)
        const image = await tiff.getImage(0)
        const md = image.getGDALMetadata(0) as Record<string, string> | null
        if (!md) return null
        const min = parseFloat(md.STATISTICS_MINIMUM)
        const max = parseFloat(md.STATISTICS_MAXIMUM)
        const mean = parseFloat(md.STATISTICS_MEAN)
        const stddev = parseFloat(md.STATISTICS_STDDEV)
        if ([min, max, mean, stddev].some(v => !Number.isFinite(v))) return null

        // Grid info — used to snap click to pixel cell for highlighting
        let pixelSize: [number, number] | undefined
        let origin: [number, number] | undefined
        let epsg: number | undefined
        try {
            const [px, py] = image.getResolution()
            const [ox, oy] = image.getOrigin()
            pixelSize = [Math.abs(px), Math.abs(py)]
            origin = [ox, oy]
            const code = image.getGeoKeys()?.ProjectedCSTypeGeoKey ?? image.getGeoKeys()?.GeographicTypeGeoKey
            if (typeof code === 'number') epsg = code
        } catch { /* metadata optional */ }

        return { minimum: min, maximum: max, mean, stddev, pixelSize, origin, epsg }
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

export function deriveRange(stats: CogMetadata, mode: 'minmax' | 'sigma'): [number, number] {
    if (mode === 'sigma') return [stats.mean - 2 * stats.stddev, stats.mean + 2 * stats.stddev]
    return [stats.minimum, stats.maximum]
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
