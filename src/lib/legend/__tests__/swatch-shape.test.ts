import { describe, it, expect } from 'vitest'
import { swatchShapeOf } from '@/lib/legend/swatch-shape'

describe('swatchShapeOf', () => {
    it('draws polygons as rectangles, even with a label layer first', () => {
        expect(swatchShapeOf(['symbol', 'fill', 'line'])).toBe('fill')
    })
    it('draws line renders as lines', () => {
        expect(swatchShapeOf(['line', 'symbol'])).toBe('line')
    })
    it('draws point renders and label-only renders as circles', () => {
        expect(swatchShapeOf(['circle'])).toBe('circle')
        expect(swatchShapeOf(['symbol'])).toBe('circle')
    })
})
