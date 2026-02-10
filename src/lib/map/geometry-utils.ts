/**
 * Geometry utilities for bounding box calculations
 */
import type { Geometry } from 'geojson'
import { bbox as turfBbox } from '@turf/bbox'

/**
 * Bounding box as [minLng, minLat, maxLng, maxLat]
 */
export type BBox = [number, number, number, number]

/**
 * Calculate bounding box from a GeoJSON geometry
 * Coordinates are expected to be in [lng, lat] format
 * @returns BBox [minLng, minLat, maxLng, maxLat] or null if invalid
 */
export function calculateBboxFromGeometry(geometry: Geometry): BBox | null {
  if (!geometry) return null
  try {
    const [minLng, minLat, maxLng, maxLat] = turfBbox(geometry)
    return [minLng, minLat, maxLng, maxLat]
  } catch {
    return null
  }
}
