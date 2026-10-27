import { describe, it, expect } from 'vitest'
import { DEFAULT_TERRAIN, resolveAppTerrain } from '../terrain'

describe('resolveAppTerrain', () => {
    it('loads flat, with 3D off by default', () => {
        expect(DEFAULT_TERRAIN).toBe(false)
    })

    it('gives an unconfigured route the global default', () => {
        expect(resolveAppTerrain('not-an-app')).toBe(DEFAULT_TERRAIN)
    })

    it('resolves a configured route', () => {
        expect(resolveAppTerrain('hazards')).toBe(false)
    })
})
