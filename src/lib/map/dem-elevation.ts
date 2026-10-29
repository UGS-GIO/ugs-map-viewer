import type { QueryClient } from '@tanstack/react-query'
import { TERRARIUM_TILES } from '@/lib/terrain'

// z13 is ~15 m per pixel in Utah, close to the source DEM; one tile covers a few miles
const ZOOM = 13
const TILE_SIZE = 256

async function loadTile(x: number, y: number): Promise<ImageData> {
  const url = TERRARIUM_TILES.replace('{z}', String(ZOOM)).replace('{x}', String(x)).replace('{y}', String(y))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DEM tile ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob())
  const ctx = new OffscreenCanvas(TILE_SIZE, TILE_SIZE).getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
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
  // DEM tiles never change; keep each for the session
  const { data } = await queryClient.fetchQuery({
    queryKey: ['dem-tile', ZOOM, x, y],
    queryFn: () => loadTile(x, y),
    staleTime: Infinity,
  })
  const i = (py * TILE_SIZE + px) * 4
  return decodeTerrarium(data[i], data[i + 1], data[i + 2])
}
