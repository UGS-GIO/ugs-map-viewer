import type { FeatureCollection } from 'geojson'
import { coordEach } from '@turf/meta'

/** WGS84 [minLon, minLat, maxLon, maxLat]. */
export type Extent = [number, number, number, number]

export function isUsableExtent(value: unknown): value is Extent {
    if (!Array.isArray(value) || value.length !== 4) return false
    const [minX, minY, maxX, maxY] = value
    if (![minX, minY, maxX, maxY].every(n => typeof n === 'number' && Number.isFinite(n))) return false
    return minX <= maxX && minY <= maxY
        && Math.abs(minX) <= 180 && Math.abs(maxX) <= 180
        && Math.abs(minY) <= 90 && Math.abs(maxY) <= 90
}

/** The first four numbers of a STAC `bbox`, which may carry a Z pair in the middle. */
export function extentFromBbox(bbox: number[] | undefined): Extent | undefined {
    if (!bbox) return undefined
    const flat: Extent | undefined = bbox.length === 6
        ? [bbox[0], bbox[1], bbox[3], bbox[4]]
        : bbox.length === 4
            ? [bbox[0], bbox[1], bbox[2], bbox[3]]
            : undefined
    return isUsableExtent(flat) ? flat : undefined
}

export function geojsonExtent(fc: FeatureCollection): Extent | undefined {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    coordEach(fc, ([x, y]) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    })
    const extent: Extent = [minX, minY, maxX, maxY]
    return isUsableExtent(extent) ? extent : undefined
}
