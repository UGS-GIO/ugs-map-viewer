import { describe, it, expect } from 'vitest'
import { parseStacBivariateLegend } from '@/components/maps/bivariate-legend'
import { nonpetrolWellsConfig } from '@/routes/_map/-shared/layers/non-petroleum-wells'

describe('parseStacBivariateLegend', () => {
    it('builds the matrix from structured row/col/noData STAC legend entries', () => {
        const grid = parseStacBivariateLegend([
            { label: 'High Cap / Low Cost', row: 0, col: 0, color: '#64acbe' },
            { label: 'High Cap / High Cost', row: 0, col: 1, color: '#574249' },
            { label: 'Low Cap / Low Cost', row: 1, col: 0, color: '#e8e8e8' },
            { label: 'Low Cap / High Cost', row: 1, col: 1, color: '#c85a5a' },
            { label: 'Not Evaluated', noData: true, color: '#ffffff', stroke: '#999999' },
        ])
        expect(grid).not.toBeNull()
        expect(grid?.rows).toBe(2)
        expect(grid?.cols).toBe(2)
        expect(grid?.colors).toEqual([
            ['#64acbe', '#574249'],
            ['#e8e8e8', '#c85a5a'],
        ])
        expect(grid?.noData).toEqual({ color: '#ffffff', opacity: 0.3, label: 'Not Evaluated' })
    })

    it('returns null when entries carry no row/col coordinates', () => {
        expect(parseStacBivariateLegend([{ label: 'Gas', color: '#e31a1c' }])).toBeNull()
    })
})

describe('nonpetrolWellsConfig popup transforms', () => {
    const fields = nonpetrolWellsConfig.sublayers?.[0]?.popupFields ?? {}

    it('null-guards Depth, County, and Location transforms', () => {
        const depth = fields['Depth']
        const county = fields['County']
        const location = fields['Location']
        if (depth?.type !== 'custom' || county?.type !== 'custom' || location?.type !== 'custom') {
            throw new Error('Expected custom transforms')
        }
        expect(depth.transform?.({})).toBe('')
        expect(depth.transform?.({ depth: 1200 })).toBe('1200 ft')
        expect(county.transform?.({ state: 'UT' })).toBe('UT')
        expect(county.transform?.({ county: 'Carbon', state: 'UT' })).toBe('Carbon, UT')
        expect(location.transform?.({})).toBe('')
        expect(location.transform?.({ town_num: 12, town_dir: 'S', range_num: 10, range_dir: 'E', sect: 5 })).toBe('12S 10E Section 5')
    })
})
