import { describe, it, expect } from 'vitest'
import { getZoomHint } from '@/hooks/use-map-zoom'

describe('getZoomHint', () => {
  const range: [number, number] = [5, 11.85]

  it('asks to zoom in below minzoom', () => {
    expect(getZoomHint(4.9, range)).toBe('in')
  })

  it('is null inside the range, minzoom included', () => {
    expect(getZoomHint(5, range)).toBeNull()
    expect(getZoomHint(11.84, range)).toBeNull()
  })

  it('asks to zoom out at maxzoom, which MapLibre treats as exclusive', () => {
    expect(getZoomHint(11.85, range)).toBe('out')
  })

  it('is null without a zoom or range', () => {
    expect(getZoomHint(null, range)).toBeNull()
    expect(getZoomHint(12, undefined)).toBeNull()
  })
})
