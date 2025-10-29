import { describe, it, expect } from 'vitest';
import { createCoordinateAdapter } from '../factory';
import { ArcGISCoordinateAdapter } from '../arcgis';
import { MapLibreCoordinateAdapter } from '../maplibre';

describe('createCoordinateAdapter - Factory Function', () => {
    it('should create ArcGIS adapter when mapType is "arcgis"', () => {
        const adapter = createCoordinateAdapter('arcgis');
        expect(adapter).toBeInstanceOf(ArcGISCoordinateAdapter);
    });

    it('should create MapLibre adapter when mapType is "maplibre"', () => {
        const adapter = createCoordinateAdapter('maplibre');
        expect(adapter).toBeInstanceOf(MapLibreCoordinateAdapter);
    });

    it('should throw error for unknown map type', () => {
        expect(() => {
            createCoordinateAdapter('unknown' as any);
        }).toThrow('Unknown map type: unknown');
    });

    it('should create different adapter instances each call', () => {
        const adapter1 = createCoordinateAdapter('arcgis');
        const adapter2 = createCoordinateAdapter('arcgis');

        expect(adapter1).not.toBe(adapter2);
        expect(adapter1).toBeInstanceOf(ArcGISCoordinateAdapter);
        expect(adapter2).toBeInstanceOf(ArcGISCoordinateAdapter);
    });

    it('should handle both adapter types consistently', () => {
        const arcgisAdapter = createCoordinateAdapter('arcgis');
        const maplibreAdapter = createCoordinateAdapter('maplibre');

        // Both should have the same interface methods
        expect(typeof arcgisAdapter.screenToMap).toBe('function');
        expect(typeof maplibreAdapter.screenToMap).toBe('function');

        expect(typeof arcgisAdapter.mapToScreen).toBe('function');
        expect(typeof maplibreAdapter.mapToScreen).toBe('function');

        expect(typeof arcgisAdapter.createBoundingBox).toBe('function');
        expect(typeof maplibreAdapter.createBoundingBox).toBe('function');

        expect(typeof arcgisAdapter.getViewBounds).toBe('function');
        expect(typeof maplibreAdapter.getViewBounds).toBe('function');

        expect(typeof arcgisAdapter.getResolution).toBe('function');
        expect(typeof maplibreAdapter.getResolution).toBe('function');
    });
});
