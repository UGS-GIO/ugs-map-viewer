import type { Feature, FeatureCollection, Geometry, Point, MultiPoint } from 'geojson'

/**
 * Deterministic client-side coordinate jitter for privacy-sensitive point data whose true
 * location shouldn't be rendered but that still needs to show up "in the vicinity".
 *
 * Deterministic = same seed always produces the same offset, so re-fetches/re-renders don't
 * wander a site around the map on every page load. This is a viewer-side stopgap; the correct
 * long-term fix is offsetting the geometry once in the dataELT pipeline.
 */

/** Deterministic 32-bit string hash (FNV-1a). */
function hashString(str: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

/** Turn a 32-bit hash into a float in [0, 1). */
function hashToUnitFloat(hash: number): number {
    return hash / 0xffffffff
}

const METERS_PER_DEGREE_LAT = 111320

/**
 * Deterministic lat/lon offset for a seed string, uniform within a disc of `maxOffsetMeters`
 * radius around the given latitude. Different seeds spread across the whole disc (angle AND
 * radius both hashed) rather than clustering along one bearing.
 */
export function deterministicOffset(
    seed: string,
    latitude: number,
    maxOffsetMeters: number,
): { dLon: number; dLat: number } {
    const angle = hashToUnitFloat(hashString(`${seed}:angle`)) * 2 * Math.PI
    // sqrt so points are uniform over the disc's AREA, not biased toward the center.
    const radiusMeters = Math.sqrt(hashToUnitFloat(hashString(`${seed}:radius`))) * maxOffsetMeters

    const dLat = (radiusMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT
    const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180)
    const dLon = metersPerDegreeLon > 0 ? (radiusMeters * Math.sin(angle)) / metersPerDegreeLon : 0

    return { dLon, dLat }
}

function jitterGeometry(geometry: Geometry, seed: string, maxOffsetMeters: number): Geometry {
    if (geometry.type === 'Point') {
        const [lon, lat] = (geometry as Point).coordinates
        const { dLon, dLat } = deterministicOffset(seed, lat, maxOffsetMeters)
        return { type: 'Point', coordinates: [lon + dLon, lat + dLat] }
    }
    if (geometry.type === 'MultiPoint') {
        const coords = (geometry as MultiPoint).coordinates
        if (coords.length === 0) return geometry
        // Same offset for every constituent point — keeps a multipart feature together.
        const [, lat0] = coords[0]
        const { dLon, dLat } = deterministicOffset(seed, lat0, maxOffsetMeters)
        return { type: 'MultiPoint', coordinates: coords.map(([lon, lat]) => [lon + dLon, lat + dLat]) }
    }
    return geometry
}

function jitterFeature(feature: Feature, seedField: string, maxOffsetMeters: number): Feature {
    const seed = feature.properties?.[seedField]
    if (seed === undefined || seed === null || !feature.geometry) return feature
    return { ...feature, geometry: jitterGeometry(feature.geometry, String(seed), maxOffsetMeters) }
}

/**
 * Apply a deterministic jitter to every Point/MultiPoint feature in a FeatureCollection, seeded
 * by each feature's `seedField` property. Features missing the seed field, or with non-point
 * geometry, pass through unchanged.
 */
export function jitterFeatureCollection(
    fc: FeatureCollection,
    seedField: string,
    maxOffsetMeters: number,
): FeatureCollection {
    return {
        ...fc,
        features: fc.features.map(feature => jitterFeature(feature, seedField, maxOffsetMeters)),
    }
}
