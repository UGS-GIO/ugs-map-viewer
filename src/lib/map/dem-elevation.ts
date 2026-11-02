import type { QueryClient } from '@tanstack/react-query'
import { lineString } from '@turf/helpers'
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

/** Tile and pixel holding a lng/lat at ZOOM, in Web Mercator. */
export function tilePixel(lng: number, lat: number) {
  const n = 2 ** ZOOM
  const rad = (lat * Math.PI) / 180
  const tx = ((lng + 180) / 360) * n
  const ty = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  const x = Math.floor(tx)
  const y = Math.floor(ty)
  return { x, y, px: Math.floor((tx - x) * TILE_SIZE), py: Math.floor((ty - y) * TILE_SIZE) }
}

/** Terrarium packs meters as R*256 + G + B/256 - 32768. */
export function decodeTerrarium(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768
}

/** Ground elevation in meters at a lng/lat, from the same DEM as 3D terrain. */
export async function elevationAt(queryClient: QueryClient, lng: number, lat: number): Promise<number> {
  const { x, y, px, py } = tilePixel(lng, lat)
  // DEM tiles never change; unused ones drop after the app's gcTime
  const { data } = await queryClient.fetchQuery({
    queryKey: ['dem-tile', ZOOM, x, y],
    queryFn: () => loadTile(x, y),
    staleTime: Infinity,
  })
  const i = (py * TILE_SIZE + px) * 4
  return decodeTerrarium(data[i], data[i + 1], data[i + 2])
}

/** `count` evenly spaced points along a path, with their distance from its start in meters. */
export function samplePath(path: [number, number][], count: number) {
  const segments = path.slice(1).map((b, i) => ({ a: path[i], b, m: length(lineString([path[i], b]), { units: 'meters' }) }))
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

/** Ground elevation in meters along a path; samples sharing a DEM tile share one fetch. */
export function elevationProfile(queryClient: QueryClient, path: [number, number][]): Promise<ProfileSample[]> {
  const totalM = length(lineString(path), { units: 'meters' })
  const count = Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.ceil(totalM / SAMPLE_SPACING_M)))
  return Promise.all(
    samplePath(path, count).map(async (p) => ({
      distanceM: p.distanceM,
      at: [p.lng, p.lat],
      elevationM: await elevationAt(queryClient, p.lng, p.lat),
    })),
  )
}

/** Distance along the ground, following the terrain between samples (a measuring wheel, not a crow). */
export function groundDistanceM(samples: Pick<ProfileSample, 'distanceM' | 'elevationM'>[]) {
  return samples.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.distanceM - samples[i].distanceM, p.elevationM - samples[i].elevationM), 0)
}
