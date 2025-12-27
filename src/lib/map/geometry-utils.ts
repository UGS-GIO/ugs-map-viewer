/**
 * Geometry utilities for bounding box calculations
 */
import type { Geometry } from 'geojson'

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

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function processCoord(coord: [number, number]) {
    minLng = Math.min(minLng, coord[0])
    minLat = Math.min(minLat, coord[1])
    maxLng = Math.max(maxLng, coord[0])
    maxLat = Math.max(maxLat, coord[1])
  }

  try {
    switch (geometry.type) {
      case 'Point':
        processCoord(geometry.coordinates as [number, number])
        break
      case 'MultiPoint':
      case 'LineString':
        for (const coord of geometry.coordinates as [number, number][]) {
          processCoord(coord)
        }
        break
      case 'MultiLineString':
      case 'Polygon':
        for (const ring of geometry.coordinates as [number, number][][]) {
          for (const coord of ring) {
            processCoord(coord)
          }
        }
        break
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates as [number, number][][][]) {
          for (const ring of polygon) {
            for (const coord of ring) {
              processCoord(coord)
            }
          }
        }
        break
      case 'GeometryCollection':
        for (const geom of geometry.geometries) {
          const bbox = calculateBboxFromGeometry(geom)
          if (bbox) {
            minLng = Math.min(minLng, bbox[0])
            minLat = Math.min(minLat, bbox[1])
            maxLng = Math.max(maxLng, bbox[2])
            maxLat = Math.max(maxLat, bbox[3])
          }
        }
        break
    }

    if (minLng === Infinity || minLat === Infinity || maxLng === -Infinity || maxLat === -Infinity) {
      return null
    }

    return [minLng, minLat, maxLng, maxLat]
  } catch {
    return null
  }
}
