import { describe, it, expect } from 'vitest';
import { LngLat } from 'maplibre-gl';
import { ExportControl } from '../export-control';

const EQUATORIAL_CIRCUMFERENCE_M = 40075016.686;
const MAPLIBRE_TILE_SIZE = 512;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

function trueMetersPerCssPixel(lat: number, zoom: number): number {
    return (EQUATORIAL_CIRCUMFERENCE_M * Math.cos(lat * Math.PI / 180)) /
        (MAPLIBRE_TILE_SIZE * Math.pow(2, zoom));
}

/**
 * The export map renders into a backing store of `clientWidth * pixelRatio` pixels and
 * the overlays are drawn in that space, so the bar has to be sized in those pixels too.
 */
function fakeExportMap(lat: number, zoom: number, cssWidth: number, pixelRatio: number) {
    const worldSize = MAPLIBRE_TILE_SIZE * Math.pow(2, zoom);
    return {
        getCenter: () => new LngLat(-111.9, lat),
        getZoom: () => zoom,
        getCanvas: () => ({
            width: cssWidth * pixelRatio,
            height: cssWidth * pixelRatio,
            clientWidth: cssWidth,
            clientHeight: cssWidth,
        }),
        unproject: ([x]: [number, number]) =>
            new LngLat(-111.9 + ((x - cssWidth / 2) * 360) / worldSize, lat),
    };
}

/** Records the geometry drawn by drawScaleBar. */
function recordingContext() {
    const fillRects: { x: number; y: number; w: number; h: number }[] = [];
    const texts: string[] = [];
    const ctx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        beginPath: () => { },
        roundRect: () => { },
        fill: () => { },
        stroke: () => { },
        fillText: (text: string) => { texts.push(text); },
        fillRect: (x: number, y: number, w: number, h: number) => { fillRects.push({ x, y, w, h }); },
    };
    return { ctx, fillRects, texts };
}

type ExportInternals = {
    drawScaleBar(
        ctx: unknown, canvasWidth: number, canvasHeight: number,
        map: unknown, scale: number, scaleUnit: 'metric' | 'imperial'
    ): void;
};

function parseLabelMeters(label: string): number {
    const [value, unit] = label.split(' ');
    const n = Number(value);
    switch (unit) {
        case 'mi': return n * METERS_PER_MILE;
        case 'ft': return n * METERS_PER_FOOT;
        case 'km': return n * 1000;
        default: return n;
    }
}

/** Draws the bar and returns its label alongside the ground distance it actually spans. */
function measureBar(
    opts: { lat: number; zoom: number; cssWidth: number; pixelRatio: number; dpi: number; unit: 'metric' | 'imperial' }
) {
    const control = new ExportControl() as unknown as ExportInternals;
    const map = fakeExportMap(opts.lat, opts.zoom, opts.cssWidth, opts.pixelRatio);
    const { ctx, fillRects, texts } = recordingContext();
    const canvasPixels = opts.cssWidth * opts.pixelRatio;

    control.drawScaleBar(ctx, canvasPixels, canvasPixels, map, opts.dpi / 96, opts.unit);

    // First fillRect is the bar itself; the two after it are the end caps.
    const barWidthPx = fillRects[0].w;
    const metersPerCanvasPixel = trueMetersPerCssPixel(opts.lat, opts.zoom) / opts.pixelRatio;

    return {
        label: texts[0],
        labelMeters: parseLabelMeters(texts[0]),
        actualMeters: barWidthPx * metersPerCanvasPixel,
        barWidthPx,
    };
}

describe('ExportControl scale bar', () => {
    // ~1% tolerance: maplibre's distanceTo is a spherical haversine while the reference
    // formula uses the equatorial circumference.
    const withinOnePercent = (a: number, b: number) => Math.abs(a / b - 1) < 0.01;

    it.each([
        { pixelRatio: 1, dpi: 96 },
        { pixelRatio: 2, dpi: 96 },
        { pixelRatio: 1, dpi: 300 },
        { pixelRatio: 2, dpi: 300 },
        { pixelRatio: 3, dpi: 150 },
    ])('bar spans its labelled distance at pixelRatio $pixelRatio, dpi $dpi', ({ pixelRatio, dpi }) => {
        const bar = measureBar({ lat: 40.5, zoom: 12, cssWidth: 1200, pixelRatio, dpi, unit: 'imperial' });
        expect(withinOnePercent(bar.actualMeters, bar.labelMeters)).toBe(true);
    });

    it('holds for metric too', () => {
        const bar = measureBar({ lat: 40.5, zoom: 12, cssWidth: 1200, pixelRatio: 2, dpi: 300, unit: 'metric' });
        expect(bar.label).toMatch(/(m|km)$/);
        expect(withinOnePercent(bar.actualMeters, bar.labelMeters)).toBe(true);
    });

    it('labels a one mile bar as 1 mi', () => {
        const bar = measureBar({ lat: 40.5, zoom: 12, cssWidth: 1200, pixelRatio: 1, dpi: 96, unit: 'imperial' });
        expect(bar.label).toBe('1 mi');
    });

    it('scales the bar with dpi so it stays a consistent physical size', () => {
        const at96 = measureBar({ lat: 40.5, zoom: 12, cssWidth: 1200, pixelRatio: 1, dpi: 96, unit: 'imperial' });
        const at300 = measureBar({ lat: 40.5, zoom: 12, cssWidth: 1200, pixelRatio: 1, dpi: 300, unit: 'imperial' });
        expect(at300.barWidthPx).toBeGreaterThan(at96.barWidthPx);
    });
});
