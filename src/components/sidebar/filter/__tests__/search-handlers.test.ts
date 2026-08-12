import { describe, it, expect } from 'vitest';
import { determineCRS } from '../search-handlers';
import type { SearchSourceConfig, ExtendedGeometry } from '../search-types';
import type { Feature, GeoJsonProperties } from 'geojson';

const postgrest: SearchSourceConfig = {
    type: 'postgREST',
    url: 'https://example.com/some_view',
    displayField: 'name',
};

function feature(
    geometry: Partial<ExtendedGeometry>,
    properties: GeoJsonProperties = {},
): Feature<ExtendedGeometry, GeoJsonProperties> {
    return { type: 'Feature', geometry: geometry as ExtendedGeometry, properties };
}

const named = (name: string) => ({ type: 'name', properties: { name } });

describe('determineCRS', () => {
    it('defaults to WGS84 when the geometry carries no crs member', () => {
        // PostGIS omits the member for SRID 4326 (GeoJSON is WGS84 by definition, RFC 7946).
        // enmin_ucrc_wells_current hits this path.
        const f = feature({ type: 'Point', coordinates: [-109.001233, 37.644381] });
        expect(determineCRS(f, postgrest)).toBe('EPSG:4326');
    });

    it('uses the embedded crs member when the source is not WGS84', () => {
        const f = feature({ type: 'Point', coordinates: [644389.1183, 4434775.2064], crs: named('EPSG:26912') });
        expect(determineCRS(f, postgrest)).toBe('EPSG:26912');
    });

    it('uses the embedded crs for Web Mercator sources', () => {
        const f = feature({ type: 'Point', coordinates: [-12688323.153, 4834713.737], crs: named('EPSG:3857') });
        expect(determineCRS(f, postgrest)).toBe('EPSG:3857');
    });

    it('parses the OGC URN form as well as the short form', () => {
        const f = feature({ type: 'Point', coordinates: [0, 0], crs: named('urn:ogc:def:crs:EPSG::26912') });
        expect(determineCRS(f, postgrest)).toBe('EPSG:26912');
    });

    it('prefers an explicit output_crs property over the embedded member', () => {
        const f = feature({ type: 'Point', coordinates: [0, 0], crs: named('EPSG:3857') }, { output_crs: 4326 });
        expect(determineCRS(f, postgrest)).toBe('EPSG:4326');
    });

    it('uses outSR for masquerade sources', () => {
        const masquerade: SearchSourceConfig = {
            type: 'masquerade',
            url: 'https://example.com/masquerade',
            displayField: 'name',
            outSR: 3857,
        };
        expect(determineCRS(feature({ type: 'Point', coordinates: [0, 0] }), masquerade)).toBe('EPSG:3857');
    });

    it('falls back to WGS84 for a null feature', () => {
        expect(determineCRS(null, postgrest)).toBe('EPSG:4326');
    });
});
