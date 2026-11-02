import { describe, it, expect } from 'vitest'
import { DEFAULT_TERRAIN, resolveAppTerrain } from '../terrain'

describe('resolveAppTerrain', () => {
    it('turns 3D on by default on desktop', () => {
        expect(DEFAULT_TERRAIN).toBe(true)
        expect(resolveAppTerrain('hazards', false)).toBe(true)
    })

    it('loads phones flat', () => {
        expect(resolveAppTerrain('hazards', true)).toBe(false)
        expect(resolveAppTerrain('not-an-app', true)).toBe(false)
    })

    it('gives an unconfigured route the global default', () => {
        expect(resolveAppTerrain('not-an-app', false)).toBe(DEFAULT_TERRAIN)
    })
})
