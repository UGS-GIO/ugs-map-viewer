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

// ── Parquet search (DuckDB-WASM) ─────────────────────────────────────────────

/**
 * Words people type as labels rather than values — "T43S R11W Sec 31". They match no
 * column, and since tokens are ANDed, leaving them in makes the whole search return
 * nothing. Dropped before the WHERE is built.
 */
const NOISE_TOKENS = new Set(['sec', 'sect', 'section', 'twp', 'township', 'rng', 'range']);

export function searchTokens(searchTerm: string): string[] {
    return searchTerm
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .filter(token => !NOISE_TOKENS.has(token.toLowerCase()));
}

/** Escape a LIKE pattern: SQL quotes plus the `%`/`_` wildcards, paired with ESCAPE '\'. */
function likePattern(token: string): string {
    return token.toLowerCase().replace(/'/g, "''").replace(/[\\%_]/g, m => `\\${m}`);
}

function searchFields(source: ParquetSearchConfig): string[] {
    const { params, displayField } = source;
    return params?.targetFields || (params?.targetField ? [params.targetField] : [displayField]);
}

/** Every column the suggestion list needs — no geometry. */
function attributeColumns(source: ParquetSearchConfig): string[] {
    return [...new Set([
        ...searchFields(source),
        source.displayField,
        ...(source.secondaryDisplayField ? [source.secondaryDisplayField] : []),
        ...(source.idField ? [source.idField] : []),
    ])];
}

function tableNameFor(url: string): string {
    const hash = [...url].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
    return `search_${(hash >>> 0).toString(36)}`;
}

/**
 * The attribute columns, materialized into DuckDB once per parquet URL per session.
 *
 * Typeahead used to run the whole search against the remote parquet on every keystroke,
 * which meant re-reading row groups over HTTP each time — and with `SELECT *` that
 * included the geometry column, by far the largest one. The attributes are small
 * (hundreds of KB for statewide PLSS), so one up-front read makes every later search a
 * local scan. Geometry is fetched only for the row the user actually picks.
 */
const searchTables = new Map<string, Promise<string>>();

async function ensureSearchTable(source: ParquetSearchConfig): Promise<string> {
    const cached = searchTables.get(source.parquetUrl);
    if (cached) return cached;

    const building = (async () => {
        const { withConnection, escapeSql, quoteIdent } = await import('@/lib/duckdb/client');
        const table = tableNameFor(source.parquetUrl);
        const columns = attributeColumns(source).map(quoteIdent).join(', ');
        await withConnection(async (conn) => {
            await conn.query(
                `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} AS ` +
                `SELECT ${columns} FROM read_parquet('${escapeSql(source.parquetUrl)}')`,
            );
        });
        return table;
    })();

    // Don't cache a failure — a dropped connection shouldn't disable search for the session.
    building.catch(() => searchTables.delete(source.parquetUrl));
    searchTables.set(source.parquetUrl, building);
    return building;
}

/**
 * Typeahead suggestions. Returns geometry-less pseudo-features (same shape the PostgREST
 * fetcher produces for non-GeoJSON rows); the combobox fetches geometry on selection.
 */
export async function fetchParquetResults(
    source: ParquetSearchConfig,
    searchTerm: string,
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
    const tokens = searchTokens(searchTerm);
    if (tokens.length === 0) return featureCollection([]);

    const { withConnection, quoteIdent, normalizeRow } = await import('@/lib/duckdb/client');
    const table = await ensureSearchTable(source);
    const fields = searchFields(source);

    // Tokens are ANDed, fields ORed: "43S 11W 31" means every token has to land somewhere.
    const whereClause = tokens
        .map(token => `(${fields
            .map(field => `LOWER(CAST(${quoteIdent(field)} AS VARCHAR)) LIKE '%${likePattern(token)}%' ESCAPE '\\'`)
            .join(' OR ')})`)
        .join(' AND ');

    // Deterministic order under the LIMIT — a broad term like "31" matches thousands.
    const orderFields = [source.displayField, source.secondaryDisplayField]
        .filter((f): f is string => Boolean(f))
        .map(quoteIdent)
        .join(', ');

    const rows = await withConnection(async (conn) => {
        const result = await conn.query(
            `SELECT * FROM ${quoteIdent(table)} WHERE ${whereClause}` +
            (orderFields ? ` ORDER BY ${orderFields}` : '') +
            ` LIMIT 100`,
        );
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });

    const features: Feature<Geometry, GeoJsonProperties>[] = rows.map((row, idx) => ({
        type: 'Feature' as const,
        id: idx,
        geometry: null as unknown as Geometry,
        properties: row,
    }));

    return featureCollection(features);
}

/**
 * Geometry column shape, resolved once per parquet URL: whether it is WKB (a BLOB, which
 * it is whenever geoparquet conversion is off) and whether it needs reprojecting. Both
 * are properties of the file, so asking per search was pure overhead.
 */
const geometryMeta = new Map<string, Promise<{ isBlob: boolean; needsTransform: boolean }>>();

async function resolveGeometryMeta(source: ParquetSearchConfig): Promise<{ isBlob: boolean; needsTransform: boolean }> {
    const cached = geometryMeta.get(source.parquetUrl);
    if (cached) return cached;

    const resolving = (async () => {
        const { withConnection, loadSpatial, escapeSql, quoteIdent } = await import('@/lib/duckdb/client');
        const geometryField = source.geometryField ?? 'geom';
        const geomCol = quoteIdent(geometryField);
        const url = escapeSql(source.parquetUrl);

        return withConnection(async (conn) => {
            await loadSpatial(conn);
            await conn.query(`SET enable_geoparquet_conversion = false`);

            const described = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${url}')`);
            let isBlob = false;
            for (const row of described.toArray()) {
                const { column_name: name, column_type: type } = row.toJSON() as Record<string, unknown>;
                if (String(name) === geometryField) {
                    isBlob = String(type).toUpperCase().includes('BLOB');
                    break;
                }
            }

            const rawGeom = isBlob ? `ST_GeomFromWKB(${geomCol})` : geomCol;
            // Projected coordinates run to millions; degrees never exceed 180.
            const probe = await conn.query(`
                SELECT max(abs(ST_X(ST_Centroid(${rawGeom})))) AS max_x
                FROM (SELECT ${geomCol} FROM read_parquet('${url}') WHERE ${geomCol} IS NOT NULL LIMIT 100)
            `);
            const maxX = Number((probe.toArray()[0]?.toJSON() as Record<string, unknown>)?.max_x ?? 0);
            return { isBlob, needsTransform: maxX > 180 };
        });
    })();

    resolving.catch(() => geometryMeta.delete(source.parquetUrl));
    geometryMeta.set(source.parquetUrl, resolving);
    return resolving;
}

/**
 * Geometry for chosen suggestions, read straight from the parquet by id. Called on
 * selection (one row) and on a collection search (the visible set), never per keystroke.
 */
export async function fetchParquetGeometries(
    source: ParquetSearchConfig,
    ids: string[],
): Promise<Map<string, Geometry>> {
    const geometries = new Map<string, Geometry>();
    const unique = [...new Set(ids)].filter(Boolean);
    if (!source.idField || unique.length === 0) return geometries;

    const { withConnection, loadSpatial, escapeSql, quoteIdent } = await import('@/lib/duckdb/client');
    const { isBlob, needsTransform } = await resolveGeometryMeta(source);

    const idCol = quoteIdent(source.idField);
    const geomCol = quoteIdent(source.geometryField ?? 'geom');
    const rawGeom = isBlob ? `ST_GeomFromWKB(${geomCol})` : geomCol;
    const geom4326 = needsTransform
        ? `ST_Force2D(ST_Transform(${rawGeom}, 'EPSG:3857', 'EPSG:4326', true))`
        : `ST_Force2D(${rawGeom})`;
    const inList = unique.map(v => `'${escapeSql(v)}'`).join(',');

    const rows = await withConnection(async (conn) => {
        await loadSpatial(conn);
        await conn.query(`SET enable_geoparquet_conversion = false`);
        const result = await conn.query(
            `SELECT CAST(${idCol} AS VARCHAR) AS _id, ST_AsGeoJSON(${geom4326}) AS _geom_json ` +
            `FROM read_parquet('${escapeSql(source.parquetUrl)}') ` +
            `WHERE CAST(${idCol} AS VARCHAR) IN (${inList})`,
        );
        return result.toArray().map(r => r.toJSON() as Record<string, unknown>);
    });

    for (const row of rows) {
        const id = String(row['_id'] ?? '');
        const geomJson = row['_geom_json'];
        if (!id || typeof geomJson !== 'string') continue;
        try {
            geometries.set(id, JSON.parse(geomJson) as Geometry);
        } catch (e) {
            console.warn(`Failed to parse geometry for ${id}:`, e);
        }
    }

    return geometries;
}

/** Attach geometry to suggestion features, dropping any the parquet can't supply. */
export async function withParquetGeometry(
    source: ParquetSearchConfig,
    features: Feature<Geometry, GeoJsonProperties>[],
): Promise<Feature<Geometry, GeoJsonProperties>[]> {
    if (!source.idField) return features;
    const idField = source.idField;
    const ids = features.map(f => String(f.properties?.[idField] ?? '')).filter(Boolean);
    const geometries = await fetchParquetGeometries(source, ids);

    return features
        .map(feature => {
            const geometry = geometries.get(String(feature.properties?.[idField] ?? ''));
            return geometry ? { ...feature, geometry } : null;
        })
        .filter((f): f is Feature<Geometry, GeoJsonProperties> => f !== null);
}
