// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mapAttributionText } from '../export-control';

function fakeMap(attributions: Record<string, string | undefined>) {
    return {
        getStyle: () => ({ sources: attributions }),
        getSource: (id: string) => ({ attribution: attributions[id] }),
    };
}

describe('mapAttributionText', () => {
    it('prints each source credit as plain text after the UGS credit', () => {
        const map = fakeMap({
            basemap: '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; OpenMapTiles',
            'terrain-dem': '<a href="https://github.com/tilezen/joerd">Terrain: USGS 3DEP, SRTM, GMTED2010 · Mapzen</a>',
        });
        expect(mapAttributionText(map)).toBe('© Utah Geological Survey | OpenFreeMap © OpenMapTiles | Terrain: USGS 3DEP, SRTM, GMTED2010 · Mapzen');
    });

    it('lists a credit shared by two sources once, and skips sources without one', () => {
        const map = fakeMap({ 'terrain-dem': 'Terrain: USGS', 'hillshade-dem': 'Terrain: USGS', 'wms-layer-Faults': undefined });
        expect(mapAttributionText(map)).toBe('© Utah Geological Survey | Terrain: USGS');
    });
});
