/**
 * Geometry utilities for bounding box calculations
 */
import type { Geometry, Polygon } from 'geojson'
import type { Map as MaplibreMap } from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/bbox'
import { createPointBufferBbox } from '@/lib/map/utils'

/**
 * Bounding box as [minLng, minLat, maxLng, maxLat]
 */
export type BBox = [number, number, number, number]

/**
 * A screen-space box as a ground polygon. All four corners are unprojected: on a rotated or tilted
 * map the box isn't axis-aligned on the ground, so two opposite corners describe the wrong area.
 */
export function screenBoxToPolygon(
  map: Pick<MaplibreMap, 'unproject'>,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
): Polygon {
  const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
  return {
    type: 'Polygon',
    coordinates: [corners.map((p) => { const { lng, lat } = map.unproject(p); return [lng, lat] })],
  }
}

/** A polygon's bounding box as sw/ne corners, for outlining it on the map. */
export function polygonBounds(polygon: Polygon): { sw: [number, number]; ne: [number, number] } {
  const [minLng, minLat, maxLng, maxLat] = turfBbox(polygon)
  return { sw: [minLng, minLat], ne: [maxLng, maxLat] }
}

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
