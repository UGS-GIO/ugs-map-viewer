import { describe, it, expect, vi, beforeEach } from 'vitest';

/** ArcGIS REST reads against a scripted `fetch`: errors reported as HTTP 200,
 *  paged features, and rows with no geometry. */
import {
    parseArcGisUrl,
    fetchArcGisInfo,
    fetchArcGisCount,
    fetchArcGisGeoJSON,
    ARCGIS_FEATURE_CAP,
} from '@/lib/map/arcgis/service';

const calls: string[] = [];
let routes: Array<[RegExp, unknown]> = [];
/** Queue consumed in order by the feature-paging tests. */
let pages: unknown[] = [];

beforeEach(() => {
    calls.length = 0;
    routes = [];
    pages = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        calls.push(String(url));
        if (/\/query\?/.test(String(url)) && pages.length > 0) {
            return { ok: true, status: 200, statusText: 'OK', json: async () => pages.shift() };
        }
        for (const [re, body] of routes) {
            if (re.test(String(url))) {
                return { ok: true, status: 200, statusText: 'OK', json: async () => body };
            }
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({}) };
    }));
});

const SERVICE = 'https://example.org/arcgis/rest/services/Muni/FeatureServer';

/** A GeoJSON page of `n` polygons. */
function page(n: number, startId = 0) {
    return {
        type: 'FeatureCollection',
        features: Array.from({ length: n }, (_, i) => ({
            type: 'Feature',
            properties: { OBJECTID: startId + i, NAME: `place-${startId + i}` },
            geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        })),
    };
}

describe('parseArcGisUrl', () => {
    it('splits a layer URL into service and layer id', () => {
        expect(parseArcGisUrl(`${SERVICE}/0`)).toEqual({ serviceUrl: SERVICE, kind: 'FeatureServer', layerId: 0 });
    });

    it('recognizes a bare service, leaving the layer id unset', () => {
        expect(parseArcGisUrl(SERVICE)).toEqual({ serviceUrl: SERVICE, kind: 'FeatureServer', layerId: undefined });
    });

    it('recognizes MapServer, which renders as an image rather than features', () => {
        const parts = parseArcGisUrl('https://example.org/arcgis/rest/services/Geo/MapServer');
        expect(parts?.kind).toBe('MapServer');
    });

    it('tolerates a trailing slash and a query string', () => {
        expect(parseArcGisUrl(`${SERVICE}/3/?f=json`)?.layerId).toBe(3);
    });

    it('is case-insensitive, since Esri URLs are written every which way', () => {
        expect(parseArcGisUrl('https://example.org/rest/services/x/featureserver/2')?.layerId).toBe(2);
    });

    it('rejects a URL that merely mentions the word', () => {
        expect(parseArcGisUrl('https://example.org/FeatureServer-notes.geojson')).toBeNull();
        expect(parseArcGisUrl('https://example.org/data.parquet')).toBeNull();
    });
});

describe('fetchArcGisInfo', () => {
    it('reads a layer’s own name and query capability', async () => {
        routes = [[/FeatureServer\/0\?/, { name: 'Municipalities', capabilities: 'Query,Extract' }]];
        const info = await fetchArcGisInfo({ serviceUrl: SERVICE, kind: 'FeatureServer', layerId: 0 });
        expect(info).toMatchObject({ name: 'Municipalities', isLayer: true, queryable: true, layers: [] });
    });

    it('lists a service’s layers so a bare URL can pick one', async () => {
        routes = [[/FeatureServer\?/, { layers: [{ id: 0, name: 'Cities' }, { id: 1, name: 'Counties' }] }]];
        const info = await fetchArcGisInfo({ serviceUrl: SERVICE, kind: 'FeatureServer' });
        expect(info.layers).toEqual([{ id: 0, name: 'Cities' }, { id: 1, name: 'Counties' }]);
        expect(info.isLayer).toBe(false);
    });

    it('skips group layers, which hold sublayers and cannot be queried', async () => {
        routes = [[/FeatureServer\?/, {
            layers: [{ id: 0, name: 'Group', subLayerIds: [1, 2] }, { id: 1, name: 'Real' }],
        }]];
        const info = await fetchArcGisInfo({ serviceUrl: SERVICE, kind: 'FeatureServer' });
        expect(info.layers).toEqual([{ id: 1, name: 'Real' }]);
    });

    it('falls back through the names a MapServer might use', async () => {
        routes = [[/MapServer\?/, { mapName: 'Layers', serviceDescription: 'ignored' }]];
        const info = await fetchArcGisInfo({ serviceUrl: 'https://x.org/MapServer', kind: 'MapServer' });
        expect(info.name).toBe('Layers');
    });

    it('raises the server’s message when it reports an error as HTTP 200', async () => {
        routes = [[/FeatureServer/, { error: { code: 400, message: 'Invalid token' } }]];
        await expect(fetchArcGisInfo({ serviceUrl: SERVICE, kind: 'FeatureServer', layerId: 0 }))
            .rejects.toThrow(/Invalid token/);
    });

    it('raises on a transport failure rather than returning an empty layer', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' })));
        await expect(fetchArcGisInfo({ serviceUrl: SERVICE, kind: 'FeatureServer', layerId: 0 }))
            .rejects.toThrow(/404/);
    });
});

describe('fetchArcGisCount', () => {
    it('asks for the count only, so a huge layer costs one small request', async () => {
        routes = [[/returnCountOnly=true/, { count: 261 }]];
        await expect(fetchArcGisCount(`${SERVICE}/0`)).resolves.toBe(261);
        expect(calls[0]).toContain('returnCountOnly=true');
        expect(calls[0]).toContain('where=1%3D1');
    });

    it('reads a missing count as zero instead of NaN', async () => {
        routes = [[/returnCountOnly/, {}]];
        await expect(fetchArcGisCount(`${SERVICE}/0`)).resolves.toBe(0);
    });
});

describe('fetchArcGisGeoJSON', () => {
    it('asks for GeoJSON in lon/lat, which is what MapLibre draws in', async () => {
        pages = [page(2)];
        await fetchArcGisGeoJSON(`${SERVICE}/0`);
        expect(calls[0]).toContain('f=geojson');
        expect(calls[0]).toContain('outSR=4326');
        expect(calls[0]).toContain('outFields=*');
    });

    it('keeps paging while the server returns full pages', async () => {
        pages = [page(1000, 0), page(1000, 1000), page(7, 2000)];
        const fc = await fetchArcGisGeoJSON(`${SERVICE}/0`);
        expect(fc.features).toHaveLength(2007);
        expect(calls).toHaveLength(3);
        expect(calls[1]).toContain('resultOffset=1000');
    });

    it('stops at the first short page — the server has nothing left', async () => {
        pages = [page(3)];
        const fc = await fetchArcGisGeoJSON(`${SERVICE}/0`);
        expect(fc.features).toHaveLength(3);
        expect(calls).toHaveLength(1);
    });

    it('never reads past the cap, however much the server offers', async () => {
        pages = Array.from({ length: 40 }, () => page(1000));
        const fc = await fetchArcGisGeoJSON(`${SERVICE}/0`, { cap: 3000 });
        expect(fc.features).toHaveLength(3000);
        expect(calls).toHaveLength(3);
    });

    it('drops rows with no geometry, which nothing can draw', async () => {
        pages = [{
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { a: 1 }, geometry: null },
                { type: 'Feature', properties: { a: 2 }, geometry: { type: 'Point', coordinates: [1, 2] } },
                { type: 'Feature', properties: { a: 3 }, geometry: { type: 'Nonsense', coordinates: [] } },
            ],
        }];
        const fc = await fetchArcGisGeoJSON(`${SERVICE}/0`);
        expect(fc.features).toHaveLength(1);
        expect(fc.features[0].properties).toEqual({ a: 2 });
    });

    it('keeps a feature id when the service sends one', async () => {
        pages = [{
            type: 'FeatureCollection',
            features: [{ type: 'Feature', id: 42, properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
        }];
        const fc = await fetchArcGisGeoJSON(`${SERVICE}/0`);
        expect(fc.features[0].id).toBe(42);
    });

    it('returns an empty collection when the layer has nothing in it', async () => {
        pages = [{ type: 'FeatureCollection', features: [] }];
        await expect(fetchArcGisGeoJSON(`${SERVICE}/0`)).resolves.toEqual({ type: 'FeatureCollection', features: [] });
    });

    it('defaults its cap rather than reading forever', () => {
        expect(ARCGIS_FEATURE_CAP).toBeGreaterThan(0);
    });
});
