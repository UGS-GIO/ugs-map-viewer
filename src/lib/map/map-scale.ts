import type maplibregl from 'maplibre-gl'

// CSS reference pixel: 1/96 inch (0.2645833 mm).
const METERS_PER_CSS_PIXEL = 0.0254 / 96

/** Ratio scale denominator (the X in 1:X) for a ground resolution in meters per CSS pixel. */
export function scaleDenominator(metersPerPixel: number): number {
  return metersPerPixel / METERS_PER_CSS_PIXEL
}

/**
 * Ground meters per CSS pixel at the center of the view, measured across a
 * horizontal span like the on-map scale bar does, so the 1:X readout and the
 * bar always agree (and both account for latitude).
 */
export function metersPerPixelAtCenter(map: maplibregl.Map, span = 100): number {
  const canvas = map.getCanvas()
  const x = canvas.clientWidth / 2
  const y = canvas.clientHeight / 2
  const width = Math.min(span, canvas.clientWidth)
  if (width <= 0) return 0
  const left = map.unproject([x - width / 2, y])
  const right = map.unproject([x + width / 2, y])
  return left.distanceTo(right) / width
}
