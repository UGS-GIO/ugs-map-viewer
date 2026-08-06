import { describe, it, expect } from 'vitest';
import { LngLat } from 'maplibre-gl';
import { DualScaleControl } from '../dual-scale-control';

const FEET_PER_METER = 3.28084;
const EQUATORIAL_CIRCUMFERENCE_M = 40075016.686;
const MAPLIBRE_TILE_SIZE = 512;

/**
 * Ground truth: MapLibre's world is `512 * 2^zoom` pixels wide, not the 256 that most
 * slippy-map references quote. Using 256 makes every scale bar report twice the real
 * distance (a 1 mile PLSS section measures as 2 miles).
 */
function trueMetersPerPixel(lat: number, zoom: number): number {
    return (EQUATORIAL_CIRCUMFERENCE_M * Math.cos(lat * Math.PI / 180)) /
        (MAPLIBRE_TILE_SIZE * Math.pow(2, zoom));
}

/** Minimal north-up, unpitched map that unprojects with real Web Mercator math. */
function fakeMap(lng: number, lat: number, zoom: number, width = 1000, height = 800) {
    const worldSize = MAPLIBRE_TILE_SIZE * Math.pow(2, zoom);
    return {
        getCenter: () => new LngLat(lng, lat),
        getZoom: () => zoom,
        getCanvas: () => ({ clientWidth: width, clientHeight: height }),
        unproject: ([x, y]: [number, number]) => {
            void y;
            return new LngLat(lng + ((x - width / 2) * 360) / worldSize, lat);
        },
    };
}

// The private members are exercised directly - they hold the arithmetic the reported
// bug lived in, and the public surface only exposes it through a canvas.
type ScaleInternals = {
    map: unknown;
    getMetersPerPixel(): number;
    getRoundScale(min: number, max: number, unit: 'metric' | 'imperial'): { distance: number; label: string };
};

function internals(control: DualScaleControl): ScaleInternals {
    return control as unknown as ScaleInternals;
}

describe('DualScaleControl.getMetersPerPixel', () => {
    // ~1% tolerance: maplibre's distanceTo is a spherical haversine (R = 6371008.8)
    // while the reference formula uses the equatorial circumference.
    it.each([
        { lat: 40.5, zoom: 14 },
        { lat: 40.5, zoom: 10 },
        { lat: 37.0, zoom: 16 },
        { lat: 0, zoom: 8 },
    ])('matches Web Mercator ground truth at lat $lat zoom $zoom', ({ lat, zoom }) => {
        const control = internals(new DualScaleControl());
        control.map = fakeMap(-111.9, lat, zoom);

        const expected = trueMetersPerPixel(lat, zoom);
        expect(control.getMetersPerPixel()).toBeCloseTo(expected, -Math.log10(expected * 0.01));
    });

    it('does not double the distance (regression: 256px vs 512px tile size)', () => {
        const control = internals(new DualScaleControl());
        control.map = fakeMap(-111.9, 40.5, 14);

        const expected = trueMetersPerPixel(40.5, 14);
        expect(control.getMetersPerPixel() / expected).toBeLessThan(1.5);
    });
});

describe('DualScaleControl.getRoundScale', () => {
    it('picks the largest candidate that fits, across a unit boundary (metric)', () => {
        const control = internals(new DualScaleControl());
        // 1 km and 500 m both fit; the unsorted candidate list used to return 500 m.
        expect(control.getRoundScale(400, 1200, 'metric').label).toBe('1 km');
    });

    it('picks the largest candidate that fits, across a unit boundary (imperial)', () => {
        const control = internals(new DualScaleControl());
        // 2 mi, 1 mi and 5000 ft all fit; the unsorted list used to return 5000 ft.
        expect(control.getRoundScale(4000, 12000, 'imperial').label).toBe('2 mi');
    });

    it('stays within the requested range', () => {
        const control = internals(new DualScaleControl());
        for (const min of [3, 30, 300, 3000, 30000]) {
            const metric = control.getRoundScale(min, min * 2.5, 'metric');
            expect(metric.distance).toBeGreaterThanOrEqual(min);
            expect(metric.distance).toBeLessThanOrEqual(min * 2.5);
        }
    });
});

describe('scale bar labelling', () => {
    it('labels a one mile bar as 1 mi', () => {
        const control = internals(new DualScaleControl({ minWidth: 60, maxWidth: 150 }));
        // Zoom 12 at Utah latitude puts a 1 mile PLSS section at ~110px wide.
        control.map = fakeMap(-111.9, 40.5, 12);

        const metersPerPixel = control.getMetersPerPixel();
        const minFeet = metersPerPixel * 60 * FEET_PER_METER;
        const maxFeet = metersPerPixel * 150 * FEET_PER_METER;
        const imperial = control.getRoundScale(minFeet, maxFeet, 'imperial');

        expect(imperial.label).toBe('1 mi');

        // The drawn bar must be as wide as a mile actually is on screen.
        const barWidthPx = (imperial.distance / FEET_PER_METER) / metersPerPixel;
        const mileWidthPx = 1609.344 / metersPerPixel;
        expect(barWidthPx).toBeCloseTo(mileWidthPx, 0);
    });
});
