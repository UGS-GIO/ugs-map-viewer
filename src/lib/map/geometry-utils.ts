/**
 * Geometry utilities for bounding box calculations
 */
import type { Geometry } from 'geojson'
import { bbox as turfBbox } from '@turf/bbox'
import { createPointBufferBbox } from '@/lib/map/utils'

/**
 * Bounding box as [minLng, minLat, maxLng, maxLat]
 */
export type BBox = [number, number, number, number]

/**
 * Calculate bounding box from a GeoJSON geometry
 * Coordinates are expected to be in [lng, lat] format
 * For Point geometries, applies a 100m buffer to avoid a degenerate zero-area bbox
 * @returns BBox [minLng, minLat, maxLng, maxLat] or null if invalid
 */
export function calculateBboxFromGeometry(geometry: Geometry): BBox | null {
  if (!geometry) return null
  try {
    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as [number, number]
      return createPointBufferBbox(coords, 0.1)
    }
    const [minLng, minLat, maxLng, maxLat] = turfBbox(geometry)
    return [minLng, minLat, maxLng, maxLat]
  } catch {
    return null
  }
}
