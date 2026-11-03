import type { QueryClient } from '@tanstack/react-query'
import { lineString, polygon } from '@turf/helpers'
import { bbox } from '@turf/bbox'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { length } from '@turf/length'
import { TERRARIUM_TILES } from '@/lib/terrain'

// z13 is ~15 m per pixel in Utah, close to the source DEM; one tile covers a few miles
const ZOOM = 13
const TILE_SIZE = 256

async function loadTile(x: number, y: number): Promise<ImageData> {
  const url = TERRARIUM_TILES.replace('{z}', String(ZOOM)).replace('{x}', String(x)).replace('{y}', String(y))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DEM tile ${res.status}`)
  // Elevations are packed in the RGB values, so no color management or alpha premultiplying
  const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  try {
    const ctx = new OffscreenCanvas(TILE_SIZE, TILE_SIZE).getContext('2d')
    if (!ctx) throw new Error('No 2D canvas')
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
  } finally {
    bitmap.close()
  }
}

/** A lng/lat's position in pixels across the whole ZOOM world, in Web Mercator; fractional. */
export function worldPixel(lng: number, lat: number) {
  const size = 2 ** ZOOM * TILE_SIZE
  const rad = (lat * Math.PI) / 180
  return {
    x: ((lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  }
}

/** Terrarium packs meters as R*256 + G + B/256 - 32768. */
export function decodeTerrarium(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768
}

/** Blend of four corner values by the fractional position between them. */
export function bilinear(v00: number, v10: number, v01: number, v11: number, tx: number, ty: number) {
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty
}

/**
 * Ground elevation in meters at each lng/lat, from the same DEM as 3D terrain. Each tile the points
 * touch is fetched once, then every read is synchronous. Blends the four nearest pixel centers so
 * slopes and ground distance don't step at pixel edges; neighbors may sit in the next tile.
 */
export async function elevationsAt(queryClient: QueryClient, lngLats: [number, number][]): Promise<number[]> {
  const corners = lngLats.map(([lng, lat]) => {
    const { x, y } = worldPixel(lng, lat)
    const fx = x - 0.5
    const fy = y - 0.5
    return { x0: Math.floor(fx), y0: Math.floor(fy), tx: fx - Math.floor(fx), ty: fy - Math.floor(fy) }
  })
  const tileKeys = new Set<string>()
  corners.forEach(({ x0, y0 }) => {
    for (const px of [x0, x0 + 1]) for (const py of [y0, y0 + 1]) tileKeys.add(`${Math.floor(px / TILE_SIZE)}/${Math.floor(py / TILE_SIZE)}`)
  })
  const tiles = new Map(
    await Promise.all(
      [...tileKeys].map(async (key) => {
        const [x, y] = key.split('/').map(Number)
        // DEM tiles never change; unused ones drop after the app's gcTime
        const tile = await queryClient.fetchQuery({ queryKey: ['dem-tile', ZOOM, x, y], queryFn: () => loadTile(x, y), staleTime: Infinity })
        return [key, tile.data] as const
      }),
    ),
  )
  const pixel = (px: number, py: number) => {
    const tx = Math.floor(px / TILE_SIZE)
    const ty = Math.floor(py / TILE_SIZE)
    const data = tiles.get(`${tx}/${ty}`)
    if (!data) throw new Error('DEM tile missing')
    const i = ((py - ty * TILE_SIZE) * TILE_SIZE + (px - tx * TILE_SIZE)) * 4
    return decodeTerrarium(data[i], data[i + 1], data[i + 2])
  }
  return corners.map(({ x0, y0, tx, ty }) => bilinear(pixel(x0, y0), pixel(x0 + 1, y0), pixel(x0, y0 + 1), pixel(x0 + 1, y0 + 1), tx, ty))
}

export async function elevationAt(queryClient: QueryClient, lng: number, lat: number): Promise<number> {
  const [e] = await elevationsAt(queryClient, [[lng, lat]])
  return e
}

/** Geodesic length of each leg of a path, in meters. */
export function segmentLengthsM(path: number[][]) {
  return path.slice(1).map((b, i) => length(lineString([path[i], b]), { units: 'meters' }))
}

/** `count` evenly spaced points along a path, with their distance from its start in meters. */
export function samplePath(path: [number, number][], count: number) {
  const segments = segmentLengthsM(path).map((m, i) => ({ a: path[i], b: path[i + 1], m }))
  const total = segments.reduce((sum, s) => sum + s.m, 0)
  let seg = 0
  let start = 0
  return Array.from({ length: count }, (_, i) => {
    const d = (total * i) / (count - 1)
    while (seg < segments.length - 1 && start + segments[seg].m < d) start += segments[seg++].m
    const { a, b, m } = segments[seg]
    const t = m ? Math.min(1, (d - start) / m) : 0
    return { distanceM: d, lng: a[0] + (b[0] - a[0]) * t, lat: a[1] + (b[1] - a[1]) * t }
  })
}

// About one sample per DEM pixel (~15 m at z13) up to a cap, so ground distance doesn't smooth out
// the terrain on long lines; at least enough for a smooth chart on short ones
const SAMPLE_SPACING_M = 30
const MIN_SAMPLES = 128
const MAX_SAMPLES = 1024

export interface ProfileSample {
  distanceM: number
  at: [number, number]
  elevationM: number
}

/** Ground elevation in meters along a path. */
export async function elevationProfile(queryClient: QueryClient, path: [number, number][]): Promise<ProfileSample[]> {
  const totalM = segmentLengthsM(path).reduce((a, b) => a + b, 0)
  const count = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.ceil(totalM / SAMPLE_SPACING_M)))
  const samples = samplePath(path, count)
  const elevations = await elevationsAt(queryClient, samples.map((p) => [p.lng, p.lat]))
  return samples.map((p, i) => ({ distanceM: p.distanceM, at: [p.lng, p.lat], elevationM: elevations[i] }))
}

/** Distance along the ground, following the terrain between samples (a measuring wheel, not a crow). */
export function groundDistanceM(samples: Pick<ProfileSample, 'distanceM' | 'elevationM'>[]) {
  return samples.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.distanceM - samples[i].distanceM, p.elevationM - samples[i].elevationM), 0)
}

const M_PER_DEG_LAT = 111_320
// Slope is taken over this run, about two DEM pixels, so one noisy pixel doesn't dominate
const SLOPE_RUN_M = 30
const MAX_GRID_POINTS = 1500

/** Grid points inside a ring, spaced so there are at most about MAX_GRID_POINTS (never closer than SLOPE_RUN_M). */
export function gridInRing(ring: [number, number][], areaM2: number) {
  const poly = polygon([ring])
  const [minX, minY, maxX, maxY] = bbox(poly)
  const spacingM = Math.max(SLOPE_RUN_M, Math.sqrt(areaM2 / MAX_GRID_POINTS))
  const dLat = spacingM / M_PER_DEG_LAT
  const dLng = spacingM / (M_PER_DEG_LAT * Math.cos((((minY + maxY) / 2) * Math.PI) / 180))
  const points: [number, number][] = []
  for (let y = minY + dLat / 2; y < maxY; y += dLat) {
    for (let x = minX + dLng / 2; x < maxX; x += dLng) {
      if (booleanPointInPolygon([x, y], poly)) points.push([x, y])
    }
  }
  return points
}

/** Slope angle (radians) from elevation rises over SLOPE_RUN_M east and north. */
export function slopeAngle(riseEastM: number, riseNorthM: number) {
  return Math.atan(Math.hypot(riseEastM, riseNorthM) / SLOPE_RUN_M)
}

/**
 * Terrain stats over a polygon: its surface area (the flat area scaled up by how steep the ground
 * is) and mean slope, from the slope at grid points inside it.
 */
export async function surfaceStats(queryClient: QueryClient, ring: [number, number][], areaM2: number) {
  const points = gridInRing(ring, areaM2)
  if (!points.length) return { surfaceAreaM2: areaM2, meanSlopeDeg: 0 }
  // Each point with neighbors SLOPE_RUN_M east and north, read in one batch
  const dLat = SLOPE_RUN_M / M_PER_DEG_LAT
  const triples = points.flatMap(([lng, lat]): [number, number][] => {
    const dLng = SLOPE_RUN_M / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
    return [[lng, lat], [lng + dLng, lat], [lng, lat + dLat]]
  })
  const e = await elevationsAt(queryClient, triples)
  const angles = points.map((_, i) => slopeAngle(e[i * 3 + 1] - e[i * 3], e[i * 3 + 2] - e[i * 3]))
  // A tilted patch covers 1/cos(slope) times its footprint
  const factor = angles.reduce((sum, a) => sum + 1 / Math.cos(a), 0) / angles.length
  const meanSlopeDeg = (angles.reduce((sum, a) => sum + a, 0) / angles.length) * (180 / Math.PI)
  return { surfaceAreaM2: areaM2 * factor, meanSlopeDeg }
}
