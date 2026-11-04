import type { Polygon } from 'geojson'
import type { BoundsBox } from '@/components/maps/types'

// Round to 6 decimal places (~0.1m precision) for cleaner URLs
export const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Bounds in the URL: sw_lng,sw_lat,ne_lng,ne_lat */
export function parseBbox(value: string | undefined): BoundsBox | null {
  if (!value) return null
  const parts = value.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { sw: [parts[0], parts[1]], ne: [parts[2], parts[3]] }
}

export const formatBbox = (b: BoundsBox | null | undefined) =>
  b ? [...b.sw, ...b.ne].map(round6).join(',') : undefined

/** A drawn polygon's outer ring in the URL: lng,lat;lng,lat;... */
export function parseArea(value: string | undefined): Polygon | null {
  if (!value) return null
  const ring = value.split(';').map((pair) => pair.split(',').map(Number))
  if (ring.length < 4 || ring.some((c) => c.length !== 2 || c.some(isNaN))) return null
  return { type: 'Polygon', coordinates: [ring] }
}

export const formatArea = (polygon: Polygon | null | undefined) =>
  polygon ? polygon.coordinates[0].map(([lng, lat]) => `${round6(lng)},${round6(lat)}`).join(';') : undefined
