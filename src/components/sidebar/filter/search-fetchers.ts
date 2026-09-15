import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from 'geojson';
import { featureCollection } from '@turf/helpers';
import type { MasqueradeConfig, ParquetSearchConfig, PostgRESTConfig, Suggestion } from './search-types';
import { appendFunctionParams } from './search-utils';

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

/**
 * A PostgREST `ilike` value. Double-quoted because a raw comma, parenthesis or dot in the
 * term would otherwise read as filter syntax and break the query.
 */
function ilikeValue(token: string): string {
    return `"*${token.replace(/"/g, '\\"')}*"`;
}

/**
 * The `ilike` filter params for a search term, ANDing tokens and ORing target fields.
 * Exported for tests — the shape is fiddly enough to be worth pinning.
 */
export function buildPostgrestSearchParams(fields: string[], searchTerm: string): URLSearchParams {
    const params = new URLSearchParams();
    const tokens = searchTokens(searchTerm);
    if (!fields.length || !tokens.length) return params;

    if (tokens.length === 1) {
        const [token] = tokens;
        if (fields.length === 1) params.set(fields[0], `ilike.${ilikeValue(token)}`);
        else params.set('or', `(${fields.map(f => `${f}.ilike.${ilikeValue(token)}`).join(',')})`);
        return params;
    }

    const clause = (token: string) => fields.length === 1
        ? `${fields[0]}.ilike.${ilikeValue(token)}`
        : `or(${fields.map(f => `${f}.ilike.${ilikeValue(token)}`).join(',')})`;
    params.set('and', `(${tokens.map(clause).join(',')})`);
    return params;
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
        // The function takes one search_term, so tokens can't be ANDed here — but the label
        // words are noise wherever they appear, so they still come out.
        const searchTermValue = `%${searchTokens(searchTerm).join(' ') || searchTerm}%`;
        if (!source.searchTerm) throw new Error(`Missing searchTerm config for function ${source.functionName}`);
        urlParams.set(source.searchTerm, searchTermValue);

        if (params && 'select' in params && params.select) {
            urlParams.set('select', params.select);
        }
        appendFunctionParams(urlParams, source);
        apiUrl = `${source.url}/rpc/${source.functionName}?${urlParams.toString()}`;
    } else {
        apiUrl = source.url;
        // Every token has to land somewhere, but any of the target fields will do — so
        // "smith federal 1" matches a row whose name holds all three, in any order and
        // spread across columns. A single ilike of the whole string only ever matched
        // one contiguous run, which is why multi-word searches came back empty.
        const fields = params && 'targetFields' in params && params.targetFields
            ? params.targetFields
            : params && 'targetField' in params && params.targetField
                ? [params.targetField]
                : [];
        for (const [key, value] of buildPostgrestSearchParams(fields, searchTerm)) {
            urlParams.set(key, value);
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

/** Escape a LIKE pattern: SQL quotes plus the `%`/`_` wildcards, paired with ESCAPE '\'. */
function likePattern(token: string): string {
    return token.toLowerCase().replace(/'/g, "''").replace(/[\\%_]/g, m => `\\${m}`);
}

function searchFields(source: ParquetSearchConfig): string[] {
    const { params, displayField } = source;
    return params?.targetFields || (params?.targetField ? [params.targetField] : [displayField]);
}

/** Every column the suggestion list needs — no geometry. Derived aliases are projected separately. */
function attributeColumns(source: ParquetSearchConfig): string[] {
    const derived = new Set(Object.keys(source.derivedFields ?? {}));
    return [...new Set([
        ...searchFields(source),
        source.displayField,
        ...(source.secondaryDisplayField ? [source.secondaryDisplayField] : []),
        ...(source.idField ? [source.idField] : []),
        // With `groupByMatch` the groupByField is the computed group's name, not a column.
        ...(source.groupByField && !source.groupByMatch ? [source.groupByField] : []),
        ...(source.groupByMatch?.map(m => m.field) ?? []),
    ])].filter(c => !derived.has(c));
}

/**
 * Group a row by which field matched, reproducing the `match_type` a search RPC used to
 * return. First field carrying a token wins; the trailing entry acts as the fallback so a
 * row that matched on a column nobody displays still lands somewhere.
 */
export function matchGroup(
    row: Record<string, unknown>,
    rules: NonNullable<ParquetSearchConfig['groupByMatch']>,
    tokens: string[],
): string {
    for (const { key, field } of rules) {
        const value = String(row[field] ?? '').toLowerCase();
        if (value && tokens.some(t => value.includes(t.toLowerCase()))) return key;
    }
    return rules[rules.length - 1]?.key ?? '';
}

/**
 * Typeahead suggestions. Returns geometry-less pseudo-features (same shape the PostgREST
 * fetcher produces for non-GeoJSON rows); the combobox fetches geometry on selection.
 */
/**
 * Start DuckDB and build the attribute tables for a config's parquet sources, without
 * waiting for them. Called when the search box opens: by the time someone finishes typing,
 * the one-time cost (worker boot plus one scan per file) is usually already paid, and a
 * session that never opens search pays nothing. Safe to call repeatedly —
 * {@link materializedAttributes} caches per url+projection, so extra calls are no-ops.
 */
export function prewarmParquetSources(sources: readonly ParquetSearchConfig[]): void {
    void (async () => {
        try {
            const { materializedAttributes } = await import('@/lib/duckdb/client');
            await Promise.all(sources.map(source => materializedAttributes({
                url: source.parquetUrl,
                columns: attributeColumns(source),
                expressions: source.derivedFields,
            })));
        } catch {
            // A failed warm-up must stay invisible: the real search will surface it.
        }
    })();
}

export async function fetchParquetResults(
    source: ParquetSearchConfig,
    searchTerm: string,
): Promise<FeatureCollection<Geometry, GeoJsonProperties>> {
    const tokens = searchTokens(searchTerm);
    if (tokens.length === 0) return featureCollection([]);

    const { withConnection, quoteIdent, normalizeRow, materializedAttributes } = await import('@/lib/duckdb/client');
    // Attributes only, materialized once per session — geometry is fetched on selection.
    const from = await materializedAttributes({
        url: source.parquetUrl,
        columns: attributeColumns(source),
        expressions: source.derivedFields,
    });
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

    // One suggestion per distinct row *as shown*, deduped before the LIMIT rather than
    // after. A layer stored as segments repeats one name over thousands of rows, so a
    // plain LIMIT 100 fills with a single fault ("wasatch" gave 1 suggestion, not 24).
    // The key is display + secondary together: PLSS shares one label across its 36
    // sections, and only the pair tells those apart.
    const rows = await withConnection(async (conn) => {
        const result = await conn.query(
            `SELECT * FROM ${from} WHERE ${whereClause}` +
            ` QUALIFY row_number() OVER (PARTITION BY ${orderFields || quoteIdent(source.displayField)}` +
            (orderFields ? ` ORDER BY ${orderFields}` : '') + `) = 1` +
            (orderFields ? ` ORDER BY ${orderFields}` : '') +
            ` LIMIT 100`,
        );
        return result.toArray().map(r => normalizeRow(r.toJSON() as Record<string, unknown>));
    });

    const features: Feature<Geometry, GeoJsonProperties>[] = rows.map((row, idx) => ({
        type: 'Feature' as const,
        id: idx,
        geometry: null as unknown as Geometry,
        properties: source.groupByMatch
            ? { ...row, [source.groupByField ?? 'match_type']: matchGroup(row, source.groupByMatch, tokens) }
            : row,
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

    // The id can be a derived alias (a fault's assembled name), which exists only in the
    // materialized attribute table — so re-project the expression here rather than the column.
    const derivedId = source.derivedFields?.[source.idField];
    const idCol = derivedId ?? quoteIdent(source.idField);
    const geomCol = quoteIdent(source.geometryField ?? 'geom');
    const rawGeom = isBlob ? `ST_GeomFromWKB(${geomCol})` : geomCol;
    const geom4326 = needsTransform
        ? `ST_Force2D(ST_Transform(${rawGeom}, 'EPSG:3857', 'EPSG:4326', true))`
        : `ST_Force2D(${rawGeom})`;
    const inList = unique.map(v => `'${escapeSql(v)}'`).join(',');

    const rows = await withConnection(async (conn) => {
        await loadSpatial(conn);
        await conn.query(`SET enable_geoparquet_conversion = false`);
        // One id can span many rows — a fault is stored as its segments, a unit as separate
        // outcrops. Union them so selecting a suggestion highlights the whole feature
        // instead of whichever segment the scan happened to read last.
        const result = await conn.query(
            `SELECT CAST(${idCol} AS VARCHAR) AS _id, ST_AsGeoJSON(ST_Union_Agg(${geom4326})) AS _geom_json ` +
            `FROM read_parquet('${escapeSql(source.parquetUrl)}') ` +
            `WHERE CAST(${idCol} AS VARCHAR) IN (${inList}) ` +
            `GROUP BY 1`,
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
