import { describe, it, expect } from 'vitest'
import { cameraChanges, cameraOf, type Camera } from '../url-camera'

describe('cameraOf', () => {
  it('reads the camera, flat and north-up when pitch and bearing are absent or unreadable', () => {
    expect(cameraOf('?lat=40&lon=-111&zoom=10')).toEqual({ center: [-111, 40], zoom: 10, pitch: 0, bearing: 0 })
    expect(cameraOf('?lat=40&lon=-111&zoom=10&pitch=abc&bearing=')).toMatchObject({ pitch: 0, bearing: 0 })
  })

  it('has no camera without lat, lon and zoom', () => {
    expect(cameraOf('?zoom=10')).toBeUndefined()
  })
})

describe('cameraChanges', () => {
  it('ignores the URL rounding', () => {
    const a: Camera = { center: [-111, 40], zoom: 10, pitch: 0, bearing: 0 }
    expect(cameraChanges(a, { ...a, center: [-111.000001, 40] })).toEqual({ moved: false, zoomed: false, turned: false })
    expect(cameraChanges(a, { ...a, zoom: 11 }).zoomed).toBe(true)
  })
})
