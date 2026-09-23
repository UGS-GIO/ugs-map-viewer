import { describe, it, expect } from 'vitest'
import { BASEMAP_STYLES, DEFAULT_BASEMAP, buildBasemapStyle, getBasemapUrl, resolveAppBasemaps, type BasemapStyle } from '../basemaps'

describe('resolveAppBasemaps', () => {
    it('gives an unconfigured route every style and the global default', () => {
        const { styles, defaultStyle } = resolveAppBasemaps('not-an-app')
        expect(styles).toEqual(BASEMAP_STYLES)
        expect(defaultStyle).toBe(DEFAULT_BASEMAP)
    })

    it.each(['carbonstorage', 'geophysics', 'minerals', 'subsurface', 'wetlands', 'wetlandplants'])(
        'leaves %s on the stock menu',
        page => {
            const { styles, defaultStyle } = resolveAppBasemaps(page)
            expect(defaultStyle.id).toBe(DEFAULT_BASEMAP.id)
            expect(styles.filter(b => b.type === 'short').map(b => b.id)).toEqual(['liberty', 'sentinel', 'lite', 'terrain'])
            expect(styles.map(b => b.id).sort()).toEqual(BASEMAP_STYLES.map(b => b.id).sort())
        },
    )

    it('opens hazards on UGRC Utah imagery', () => {
        expect(resolveAppBasemaps('hazards').defaultStyle.id).toBe('utah-satellite')
    })

    it('hides Sentinel-2 from hazards', () => {
        expect(resolveAppBasemaps('hazards').styles.map(b => b.id)).not.toContain('sentinel')
    })

    it('promotes the configured ids to nav buttons, in order', () => {
        const short = resolveAppBasemaps('hazards').styles.filter(b => b.type === 'short').map(b => b.id)
        expect(short).toEqual(['liberty', 'utah-satellite', 'lite', 'terrain'])
    })

    it('leaves unlisted styles in the dropdown', () => {
        const long = resolveAppBasemaps('hazards').styles.filter(b => b.type === 'long').map(b => b.id)
        expect(long).toEqual(['hybrid', 'none'])
    })
})

describe('getBasemapUrl', () => {
    it('returns each configured basemap url by id', () => {
        for (const style of BASEMAP_STYLES) {
            expect(getBasemapUrl(style.id)).toBe(style.url)
        }
    })

    it('throws on an unknown id', () => {
        expect(() => getBasemapUrl('nope')).toThrow(/unknown basemap id/i)
    })
})

describe('buildBasemapStyle', () => {
    const byId = (id: string): BasemapStyle => {
        const style = BASEMAP_STYLES.find(b => b.id === id)
        if (!style) throw new Error(id)
        return style
    }
    const layerIds = (id: string) => {
        const style = buildBasemapStyle(byId(id))
        return typeof style === 'string' ? style : style.layers.map(l => l.id)
    }

    it('passes vector style URLs through', () => {
        expect(buildBasemapStyle(byId('liberty'))).toBe(byId('liberty').url)
    })

    it('draws the Sentinel-2 underlay beneath the Utah-only rasters', () => {
        expect(layerIds('utah-satellite')).toEqual(['underlay-layer', 'raster-layer'])
        expect(layerIds('hybrid')).toEqual(['underlay-layer', 'raster-layer'])
    })

    it('adds no underlay to rasters that are opaque outside Utah', () => {
        expect(layerIds('lite')).toEqual(['raster-layer'])
        expect(layerIds('terrain')).toEqual(['raster-layer'])
    })
})
