import { describe, it, expect } from 'vitest'
import { BASEMAP_STYLES, DEFAULT_BASEMAP, resolveAppBasemaps } from '../basemaps'

describe('resolveAppBasemaps', () => {
    it('gives an unconfigured app every style and the global default', () => {
        const { styles, defaultStyle } = resolveAppBasemaps('subsurface')
        expect(styles).toEqual(BASEMAP_STYLES)
        expect(defaultStyle).toBe(DEFAULT_BASEMAP)
    })

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
