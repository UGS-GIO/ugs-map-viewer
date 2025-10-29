import { describe, it, expect, beforeEach } from 'vitest';
import { getMapImplementation } from '@/lib/map/get-map-implementation';

describe('getMapImplementation - Feature Flag Reader', () => {
    beforeEach(() => {
        // Clear the environment variable before each test
        delete import.meta.env.VITE_MAP_IMPL;
    });

    it('should return "arcgis" when VITE_MAP_IMPL is "arcgis"', () => {
        import.meta.env.VITE_MAP_IMPL = 'arcgis';
        expect(getMapImplementation()).toBe('arcgis');
    });

    it('should return "maplibre" when VITE_MAP_IMPL is "maplibre"', () => {
        import.meta.env.VITE_MAP_IMPL = 'maplibre';
        expect(getMapImplementation()).toBe('maplibre');
    });

    it('should default to "arcgis" when VITE_MAP_IMPL is not set', () => {
        delete import.meta.env.VITE_MAP_IMPL;
        expect(getMapImplementation()).toBe('arcgis');
    });

    it('should return consistent results on multiple calls', () => {
        import.meta.env.VITE_MAP_IMPL = 'maplibre';
        expect(getMapImplementation()).toBe('maplibre');
        expect(getMapImplementation()).toBe('maplibre');
        expect(getMapImplementation()).toBe('maplibre');
    });

    it('should handle empty string by defaulting to arcgis', () => {
        import.meta.env.VITE_MAP_IMPL = '';
        expect(getMapImplementation()).toBe('arcgis');
    });
});
