export interface Camera {
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

/** The camera in a URL's search, or undefined when it has none (before the map first writes it). */
export function cameraOf(search: string): Camera | undefined {
  const params = new URLSearchParams(search)
  const [lat, lon, zoom] = ['lat', 'lon', 'zoom'].map((key) => Number(params.get(key) ?? NaN))
  if ([lat, lon, zoom].some(Number.isNaN)) return undefined
  // Absent is flat and north-up; so is anything unreadable
  const angle = (key: string) => Number(params.get(key) ?? 0) || 0
  return { center: [lon, lat], zoom, pitch: angle('pitch'), bearing: angle('bearing') }
}

/** What differs between two cameras, beyond the rounding the URL applies */
export function cameraChanges(a: Camera, b: Camera) {
  return {
    moved: Math.abs(a.center[0] - b.center[0]) > 1e-5 || Math.abs(a.center[1] - b.center[1]) > 1e-5,
    zoomed: Math.abs(a.zoom - b.zoom) > 0.01,
    turned: Math.abs(a.pitch - b.pitch) > 1 || Math.abs(a.bearing - b.bearing) > 1,
  }
}
