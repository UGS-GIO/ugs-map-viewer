import { describe, it, expect } from 'vitest'
import { swatchShapeOf, swatchSvgHtml } from '@/lib/legend/swatch-shape'

describe('swatchShapeOf', () => {
    it('draws polygons as rectangles, even with a label layer first', () => {
        expect(swatchShapeOf(['symbol', 'fill', 'line'])).toBe('fill')
    })
    it('draws fill-pattern layers as hatched rectangles, even over a solid fill', () => {
        expect(swatchShapeOf([
            { type: 'fill', paint: { 'fill-color': '#ff0000', 'fill-opacity': 0.1 } },
            { type: 'fill', paint: { 'fill-pattern': 'slash-no-ccus-zone' } },
            { type: 'line', paint: { 'line-color': '#000000' } },
        ])).toBe('hatch')
        expect(swatchShapeOf([
            { type: 'fill', paint: { 'fill-pattern': '' } },
            { type: 'fill', paint: { 'fill-color': '#ff0000' } },
        ])).toBe('fill')
    })
    it('draws line renders as lines', () => {
        expect(swatchShapeOf(['line', 'symbol'])).toBe('line')
    })
    it('draws point renders and label-only renders as circles', () => {
        expect(swatchShapeOf(['circle'])).toBe('circle')
        expect(swatchShapeOf(['symbol'])).toBe('circle')
    })
})

describe('swatchSvgHtml', () => {
    it('emits valid SVG strings for every swatch shape', () => {
        expect(swatchSvgHtml('fill', '#ff0000', '#000000')).toContain('<rect')
        expect(swatchSvgHtml('hatch', '#ff0000', '#000000')).toContain('<pattern')
        expect(swatchSvgHtml('line', '#0000ff')).toContain('<line')
        expect(swatchSvgHtml('circle', '#00ff00')).toContain('<circle')
        expect(swatchSvgHtml('triangle', '#ffaa00')).toContain('<polygon')
    })
})
