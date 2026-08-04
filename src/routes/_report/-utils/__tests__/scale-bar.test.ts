import { describe, it, expect } from 'vitest';
import { calculateScaleBar } from '@/routes/_report/-utils/scale-bar';

/** Ground meters the bar actually spans, given the same projection the preview uses. */
function drawnMeters(pixelWidth: number, bboxWidthMeters: number, canvasWidth: number, centerLat: number) {
    const metersPerPixel = (bboxWidthMeters * Math.cos(centerLat * Math.PI / 180)) / canvasWidth;
    return pixelWidth * metersPerPixel;
}

function labelMeters(text: string): number {
    const [value, unit] = text.split(' ');
    return Number(value) * (unit === 'km' ? 1000 : 1);
}

describe('calculateScaleBar', () => {
    const canvasWidths = [320, 480, 800, 1200];
    // Span a wide range of extents so the nice-number choice lands in every band.
    const bboxWidths = [200, 800, 3000, 12000, 60000, 250000, 900000];

    it('draws a bar that spans exactly the distance it is labelled with', () => {
        for (const canvasWidth of canvasWidths) {
            for (const bboxWidthMeters of bboxWidths) {
                const bar = calculateScaleBar(bboxWidthMeters, canvasWidth, 39.5);
                const actual = drawnMeters(bar.pixelWidth, bboxWidthMeters, canvasWidth, 39.5);
                // Only rounding to whole pixels should separate the two.
                expect(Math.abs(actual - labelMeters(bar.text))).toBeLessThan(
                    (bboxWidthMeters * Math.cos(39.5 * Math.PI / 180)) / canvasWidth
                );
            }
        }
    });

    it('never exceeds the target width, so nothing needs clamping', () => {
        for (const canvasWidth of canvasWidths) {
            for (const bboxWidthMeters of bboxWidths) {
                const targetPixels = Math.min(canvasWidth / 5, 150);
                const bar = calculateScaleBar(bboxWidthMeters, canvasWidth, 39.5);
                expect(bar.pixelWidth).toBeLessThanOrEqual(Math.ceil(targetPixels));
            }
        }
    });

    it('stays wide enough to render without a minimum-width override', () => {
        for (const bboxWidthMeters of bboxWidths) {
            const bar = calculateScaleBar(bboxWidthMeters, 800, 39.5);
            expect(bar.pixelWidth).toBeGreaterThanOrEqual(30);
        }
    });

    it('switches to km past 1000 m', () => {
        expect(calculateScaleBar(200, 800, 39.5).text).toMatch(/ m$/);
        expect(calculateScaleBar(900000, 800, 39.5).text).toMatch(/ km$/);
    });
});
