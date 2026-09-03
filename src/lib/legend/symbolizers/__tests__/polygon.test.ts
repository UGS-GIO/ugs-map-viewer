// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPolygonSymbol } from '../polygon';
import type { Symbolizer } from '../../../types/geoserver-types';

const borderSymbolizer: Symbolizer = { Polygon: { stroke: '#5B6470', 'stroke-width': '1.2' } };
const graphicStrokeSymbolizer = (mark: string): Symbolizer => ({
    Polygon: { 'graphic-stroke': { size: '6', graphics: [{ mark, stroke: '#5B6470', 'stroke-width': '1' }] } },
});

describe('createPolygonSymbol', () => {
    it('draws inward ticks on all four edges for a vertline graphic-stroke (closed-basin symbol)', () => {
        const svg = createPolygonSymbol([borderSymbolizer, graphicStrokeSymbolizer('shape://vertline')]);
        expect(svg.querySelectorAll(':scope > rect:not(.legend-canvas)')).toHaveLength(1);

        const lines = Array.from(svg.querySelectorAll('line'));
        expect(lines).toHaveLength(18); // 6 top + 6 bottom + 3 left + 3 right on the 28x14 rect

        // every tick meets one of the four rect edges (top y=3, bottom y=17, left x=2, right x=30)
        const onTop = lines.filter(l => l.getAttribute('y1') === '3').length;
        const onBottom = lines.filter(l => l.getAttribute('y1') === '17').length;
        const onLeft = lines.filter(l => l.getAttribute('x1') === '2').length;
        const onRight = lines.filter(l => l.getAttribute('x1') === '30').length;
        expect([onTop, onBottom, onLeft, onRight].every(n => n > 0)).toBe(true);
        expect(onTop + onBottom + onLeft + onRight).toBe(18);

        // styled from the graphic mark
        lines.forEach(l => {
            expect(l.getAttribute('stroke')).toBe('#5B6470');
            expect(l.getAttribute('stroke-width')).toBe('1');
        });
    });

    it('does not draw ticks for a non-tick graphic-stroke mark (leaves the plain box)', () => {
        const svg = createPolygonSymbol([borderSymbolizer, graphicStrokeSymbolizer('shape://slash')]);
        expect(svg.querySelectorAll('line')).toHaveLength(0);
        expect(svg.querySelectorAll(':scope > rect:not(.legend-canvas)')).toHaveLength(1);
    });

    it('draws no ticks when there is no graphic-stroke', () => {
        const svg = createPolygonSymbol([{ Polygon: { fill: '#aabbcc', 'fill-opacity': '1', stroke: '#000000' } }]);
        expect(svg.querySelectorAll('line')).toHaveLength(0);
        expect(svg.querySelectorAll(':scope > rect:not(.legend-canvas)')).toHaveLength(1);
    });

    it('draws the symbol over a map-toned canvas so a transparent fill is not the panel', () => {
        const svg = createPolygonSymbol([{ Polygon: { stroke: '#5B6470', 'stroke-width': '1' } }]);
        const rects = Array.from(svg.querySelectorAll(':scope > rect'));

        expect(rects).toHaveLength(2);
        // the canvas is drawn first, so the symbol paints over it
        expect(rects[0].getAttribute('class')).toBe('legend-canvas');
        expect(rects[1].getAttribute('fill')).toBe('transparent');
        // same box as the symbol
        expect(rects[0].getAttribute('width')).toBe(rects[1].getAttribute('width'));
        expect(rects[0].getAttribute('height')).toBe(rects[1].getAttribute('height'));
    });

    it('falls back to legend ink when the style leaves the outline unpainted', () => {
        const unpainted = createPolygonSymbol([{ Polygon: { fill: '#aabbcc', stroke: 'none' } }]);
        const painted = createPolygonSymbol([{ Polygon: { fill: '#aabbcc', stroke: '#5B6470' } }]);

        expect(unpainted.querySelector(':scope > rect:not(.legend-canvas)')?.classList.contains('legend-ink')).toBe(true);
        expect(painted.querySelector(':scope > rect:not(.legend-canvas)')?.classList.contains('legend-ink')).toBe(false);
    });
});
