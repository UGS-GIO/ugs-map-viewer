import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from 'geojson';
import { featureCollection } from '@turf/helpers';
import type { MasqueradeConfig, ParquetSearchConfig, PostgRESTConfig, Suggestion } from './search-types';
import { appendFunctionParams } from './search-utils';

export async function fetchMasqueradeSuggestions(
    source: MasqueradeConfig,
    searchTerm: string,
): Promise<Suggestion[]> {
    const params = new URLSearchParams();
    params.set('text', searchTerm.trim());
    params.set('maxSuggestions', (source.maxSuggestions ?? 6).toString());
    params.set('outSR', JSON.stringify({ wkid: source.outSR ?? 4326 }));
    params.set('f', 'json');

    const suggestUrl = `${source.url}/suggest?${params.toString()}`;
    const response = await fetch(suggestUrl, { method: 'GET', headers: source.headers });

    if (!response.ok) {
        throw new Error(`Suggest API error (${response.status}) from ${suggestUrl}`);
    }
    const data = await response.json();
    const suggestions = (data?.suggestions || []) as Suggestion[];

    return suggestions.filter(s => {
        const magicKey = s.magicKey || '';
        return (
            magicKey.includes('opensgid.location.address_points') ||
            magicKey.includes('opensgid.boundaries.municipal') ||
            magicKey.includes('gnis.place_names')
        );
    });
}

export async function fetchPostgRESTResults(
    source: PostgRESTConfig,
    searchTerm: string,
    sourceIndex: number,
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
    const params = source.params;
    const urlParams = new URLSearchParams();
    let apiUrl = '';
    const headers: HeadersInit = source.headers || {};

    if (source.functionName) {
        const searchTermValue = `%${searchTerm}%`;
        if (!source.searchTerm) throw new Error(`Missing searchTerm config for function ${source.functionName}`);
        urlParams.set(source.searchTerm, searchTermValue);

        if (params && 'select' in params && params.select) {
            urlParams.set('select', params.select);
        }
        appendFunctionParams(urlParams, source);
        apiUrl = `${source.url}/rpc/${source.functionName}?${urlParams.toString()}`;
    } else {
        apiUrl = source.url;
        const searchTermValue = `%${searchTerm}%`;

        if (params && 'targetFields' in params && params.targetFields && searchTermValue) {
            const orConditions = params.targetFields.map(f => `${f}.ilike.${searchTermValue}`).join(',');
            urlParams.set('or', `(${orConditions})`);
        } else if (params && 'targetField' in params && params.targetField && searchTermValue) {
            urlParams.set(params.targetField, `ilike.${searchTermValue}`);
        }

        if (params && 'select' in params && params.select) {
            urlParams.set('select', params.select);
        } else {
            urlParams.set('select', `*,geometry`);
            if (!params || (params && !('select' in params))) {
                console.warn(`Source ${sourceIndex} ('${source.url}'): Defaulting select to '*,geometry'.`);
            }
        }
        urlParams.set('limit', '100');
        apiUrl = `${apiUrl}?${urlParams.toString()}`;
    }

    const response = await fetch(apiUrl, { method: 'GET', headers });
    if (!response.ok) {
        throw new Error(`PostgREST error (${response.status}) from ${apiUrl}`);
    }
    const data = await response.json();

    if (data && Array.isArray(data)) {
        if (data.length === 0 || data[0]?.type === 'Feature') {
            return featureCollection(data as Feature<Geometry, GeoJsonProperties>[]);
        }
        // Plain objects — convert to pseudo-features for display
        const pseudoFeatures: Feature<Geometry, GeoJsonProperties>[] = data.map((item, idx) => ({
            type: 'Feature' as const,
            id: idx,
            geometry: null as unknown as Geometry,
            properties: item
        }));
        return featureCollection(pseudoFeatures);
    } else if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) {
        return data as FeatureCollection<Geometry, GeoJsonProperties>;
    }

    console.warn(`Unexpected API response from ${apiUrl}`, data);
    return featureCollection([]);
}

export async function fetchParquetResults(
    source: ParquetSearchConfig,
    searchTerm: string,
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
    const { parquetUrl, displayField, geometryField = 'geom', params } = source;
    const fieldsToSearch = params?.targetFields || (params?.targetField ? [params.targetField] : [displayField]);

    const tokens = searchTerm.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return featureCollection([]);

    const { withConnection, loadSpatial, escapeSql, quoteIdent, normalizeRow } = await import('@/lib/duckdb/client');

    const tokenClauses = tokens.map(token => {
        const escapedToken = escapeSql(token);
        const sub = fieldsToSearch.map(field => `LOWER(CAST(${quoteIdent(field)} AS VARCHAR)) LIKE LOWER('%${escapedToken}%')`);
        return `(${sub.join(' OR ')})`;
    });

    const whereClause = tokenClauses.join(' AND ');

    const rows = await withConnection(async (conn) => {
        await loadSpatial(conn);
        await conn.query(`SET enable_geoparquet_conversion = false`);

        const escapedUrl = escapeSql(parquetUrl);
        const geomCol = quoteIdent(geometryField);

        const described = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${escapedUrl}')`);
        let geomIsBlob = false;
        for (const row of described.toArray()) {
            const { column_name: name, column_type: type } = row.toJSON() as Record<string, unknown>;
            if (String(name) === geometryField) {
                geomIsBlob = String(type).toUpperCase().includes('BLOB');
                break;
            }
        }

        const rawGeom = geomIsBlob ? `ST_GeomFromWKB(${geomCol})` : geomCol;

        const probe = await conn.query(`
            SELECT max(abs(ST_X(ST_Centroid(${rawGeom})))) AS max_x
            FROM (SELECT ${geomCol} FROM read_parquet('${escapedUrl}') WHERE ${geomCol} IS NOT NULL LIMIT 100)
        `);
        const maxX = Number((probe.toArray()[0]?.toJSON() as Record<string, unknown>)?.max_x ?? 0);
        const needsTransform = maxX > 180;

        const geom4326 = needsTransform
            ? `ST_Force2D(ST_Transform(${rawGeom}, 'EPSG:3857', 'EPSG:4326', true))`
            : `ST_Force2D(${rawGeom})`;

        const query = `
            SELECT
                ST_AsGeoJSON(${geom4326}) AS _geom_json,
                *
            FROM read_parquet('${escapedUrl}')
            WHERE ${whereClause}
            LIMIT 100;
        `;

        const result = await conn.query(query);
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });

    const features: Feature<Geometry, GeoJsonProperties>[] = rows.map((row, idx) => {
        let geometry: Geometry | null = null;
        const properties: GeoJsonProperties = { ...row };
        const geomJson = properties['_geom_json'];
        delete properties['_geom_json'];

        if (geomJson && typeof geomJson === 'string') {
            try {
                geometry = JSON.parse(geomJson);
            } catch (e) {
                console.warn(`Failed to parse geometry for row ${idx}:`, e);
            }
        }

        return {
            type: 'Feature' as const,
            id: idx,
            geometry: geometry!,
            properties,
        };
    });

    return featureCollection(features);
}
