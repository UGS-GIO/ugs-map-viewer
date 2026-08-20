// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPolygonSymbol } from '../polygon';
import type { Symbolizer } from '../../../types/geoserver-types';

describe('createPolygonSymbol', () => {
    it('renders inward perpendicular border ticks for a polygon graphic-stroke (closed-basin hachures)', () => {
        // Mirrors GetLegendGraphic JSON: a solid border symbolizer + a graphic-stroke symbolizer.
        const symbolizers: Symbolizer[] = [
            { Polygon: { stroke: '#5B6470', 'stroke-width': '1.2' } },
            { Polygon: { 'graphic-stroke': { size: '6', graphics: [{ mark: 'shape://vertline', stroke: '#5B6470', 'stroke-width': '1' }] } } },
        ];

        const svg = createPolygonSymbol(symbolizers);

        expect(svg.querySelectorAll('rect')).toHaveLength(1); // the hollow box
        const lines = svg.querySelectorAll('line');
        expect(lines.length).toBeGreaterThan(8); // ticks on all four edges

        // ticks are styled from the graphic mark, and each meets a rect edge (x in {2,30} or y in {3,17})
        const edges = new Set(['2', '30', '3', '17']);
        lines.forEach(line => {
            expect(line.getAttribute('stroke')).toBe('#5B6470');
            const onEdge = edges.has(line.getAttribute('x1')!) || edges.has(line.getAttribute('y1')!);
            expect(onEdge).toBe(true);
        });
    });

    it('draws no ticks when there is no graphic-stroke', () => {
        const svg = createPolygonSymbol([{ Polygon: { fill: '#aabbcc', 'fill-opacity': '1', stroke: '#000000' } }]);
        expect(svg.querySelectorAll('line')).toHaveLength(0);
        expect(svg.querySelectorAll('rect')).toHaveLength(1);
    });
});
