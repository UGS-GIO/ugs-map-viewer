import { describe, it, expect } from 'vitest'
import { buildCogProtocolUrl } from '../setup'
import type { COGLayerProps } from '@/lib/types/mapping-types'

const layer: COGLayerProps = {
    type: 'cog',
    title: 'test',
    cogUrl: 'https://example.org/a.tif',
    colorStops: ['#000000', '#ffffff'],
}

describe('buildCogProtocolUrl', () => {
    it('appends the colour hash for a stretched single-band COG', () => {
        expect(buildCogProtocolUrl(layer, [0, 10]))
            .toBe('cog://https://example.org/a.tif#color:["#000000","#ffffff"],0,10,c')
    })

    it('honours the discrete and reverse modifiers', () => {
        expect(buildCogProtocolUrl({ ...layer, continuous: false, reverse: true }, [0, 10]))
            .toBe('cog://https://example.org/a.tif#color:["#000000","#ffffff"],0,10,-')
    })

    it('omits the hash for an RGB scan so the protocol draws its own bands', () => {
        expect(buildCogProtocolUrl(layer, undefined)).toBe('cog://https://example.org/a.tif')
    })
})
