import { describe, it, expect } from 'vitest';
import { deterministicOffset, jitterFeatureCollection } from '../jitter-point';
import type { FeatureCollection, Point } from 'geojson';

describe('deterministicOffset', () => {
    it('is deterministic — same seed and latitude always produce the same offset', () => {
        const a = deterministicOffset('SV-1018', 39.555, 1600);
        const b = deterministicOffset('SV-1018', 39.555, 1600);
        expect(a).toEqual(b);
    });

    it('produces different offsets for different seeds (not a constant shift)', () => {
        const a = deterministicOffset('SV-1018', 39.555, 1600);
        const b = deterministicOffset('CB-042', 39.555, 1600);
        expect(a).not.toEqual(b);
    });

    it('stays within the requested radius (converted back to meters)', () => {
        const latitude = 40.5;
        const maxOffsetMeters = 1600;
        for (const seed of ['a', 'b', 'c', 'site-1', 'site-2', 'JOR-092']) {
            const { dLon, dLat } = deterministicOffset(seed, latitude, maxOffsetMeters);
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLon = metersPerDegreeLat * Math.cos((latitude * Math.PI) / 180);
            const distanceMeters = Math.sqrt((dLat * metersPerDegreeLat) ** 2 + (dLon * metersPerDegreeLon) ** 2);
            expect(distanceMeters).toBeLessThanOrEqual(maxOffsetMeters + 1e-6);
        }
    });

    it('returns zero offset at the poles where longitude degrees collapse (no NaN/Infinity)', () => {
        const { dLon, dLat } = deterministicOffset('site', 90, 1600);
        expect(Number.isFinite(dLon)).toBe(true);
        expect(Number.isFinite(dLat)).toBe(true);
    });
});

describe('jitterFeatureCollection', () => {
    const makeFc = (props: Record<string, unknown>, coords: [number, number] = [-111.5, 40.5]): FeatureCollection => ({
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: props,
                geometry: { type: 'Point', coordinates: coords } satisfies Point,
            },
        ],
    });

    it('shifts a Point feature away from its original coordinates', () => {
        const fc = makeFc({ sitecode: 'SV-1018' });
        const jittered = jitterFeatureCollection(fc, 'sitecode', 1600);
        const [lon, lat] = (jittered.features[0].geometry as Point).coordinates;
        const [origLon, origLat] = (fc.features[0].geometry as Point).coordinates;
        expect([lon, lat]).not.toEqual([origLon, origLat]);
    });

    it('is deterministic across repeated calls for the same feature', () => {
        const fc = makeFc({ sitecode: 'SV-1018' });
        const first = jitterFeatureCollection(fc, 'sitecode', 1600);
        const second = jitterFeatureCollection(fc, 'sitecode', 1600);
        expect(first.features[0].geometry).toEqual(second.features[0].geometry);
    });

    it('passes features through unchanged when the seed field is missing', () => {
        const fc = makeFc({ notTheSeedField: 'x' });
        const jittered = jitterFeatureCollection(fc, 'sitecode', 1600);
        expect(jittered.features[0].geometry).toEqual(fc.features[0].geometry);
    });

    it('two different sites do not land on the same jittered point', () => {
        const fcA = makeFc({ sitecode: 'SV-1018' });
        const fcB = makeFc({ sitecode: 'CB-042' });
        const a = jitterFeatureCollection(fcA, 'sitecode', 1600).features[0].geometry as Point;
        const b = jitterFeatureCollection(fcB, 'sitecode', 1600).features[0].geometry as Point;
        expect(a.coordinates).not.toEqual(b.coordinates);
    });
});
