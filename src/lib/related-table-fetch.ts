/**
 * Shared related-table fetch logic — used by the popup/table-view bulk fetch
 * (`useBulkRelatedTable`) AND the layerlist's bulk "download related table"
 * export, so the postgrest/wfs/parquet dispatch lives in exactly one place.
 */

import { isValidElement } from 'react';
import type { RelatedTable, DisplayField } from '@/lib/types/mapping-types';
import type { PostgRESTRow } from '@/lib/types/postgrest-types';
import { buildCSV } from '@/lib/download-utils';
import { formatNumeric } from '@/lib/utils';

/**
 * Fetch every related row whose `matchingField` is in `values`, dispatching on
 * `fetchMode` (postgrest default, wfs, or STAC geoparquet via duckdb-wasm).
 */
export async function fetchRelatedRows(config: RelatedTable, values: string[]): Promise<PostgRESTRow[]> {
    const matchingField = config.matchingField;
    const uniqueValues = [...new Set(values.filter(Boolean))];
    if (!matchingField || uniqueValues.length === 0) return [];

    if (config.fetchMode === 'parquet' && config.url) {
        // Lazy import keeps duckdb off the initial bundle.
        const { queryParquetByValues } = await import('@/lib/duckdb/client');
        return queryParquetByValues({
            url: config.url,
            matchingField,
            values: uniqueValues,
            sortBy: config.sortBy,
            sortDirection: config.sortDirection,
        });
    }

    if (config.fetchMode === 'wfs' && config.wfsTypeName && config.url) {
        const inValues = uniqueValues.map(v => `'${v}'`).join(',');
        const cqlFilter = `${matchingField} IN (${inValues})`;
        const wfsUrl = new URL(config.url);
        wfsUrl.searchParams.set('service', 'WFS');
        wfsUrl.searchParams.set('version', '1.1.0');
        wfsUrl.searchParams.set('request', 'GetFeature');
        wfsUrl.searchParams.set('typeName', config.wfsTypeName);
        wfsUrl.searchParams.set('outputFormat', 'application/json');
        wfsUrl.searchParams.set('CQL_FILTER', cqlFilter);
        if (config.sortBy) {
            const dir = config.sortDirection === 'desc' ? ' D' : ' A';
            wfsUrl.searchParams.set('sortBy', `${config.sortBy}${dir}`);
        }

        const response = await fetch(wfsUrl.toString());
        if (!response.ok) {
            console.error(`[fetchRelatedRows] WFS fetch failed: ${response.status}`);
            return [];
        }
        const geojson = await response.json();
        return (geojson.features || []).map((f: { properties?: PostgRESTRow }) => f.properties || {});
    }

    if (config.url) {
        const inValues = uniqueValues.join(',');
        let queryUrl = `${config.url}?${matchingField}=in.(${inValues})`;
        if (config.sortBy) {
            const dir = config.sortDirection === 'desc' ? 'desc' : 'asc';
            queryUrl += `&order=${config.sortBy}.${dir}`;
        }

        const response = await fetch(queryUrl, { headers: config.headers });
        if (!response.ok) {
            console.error(`[fetchRelatedRows] fetch failed: ${response.status}`);
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [data];
    }

    return [];
}

/** Max join keys per postgrest/wfs request — keeps the `in.(…)`/CQL URL under
 *  server request-line limits. A whole-layer export can have thousands of keys. */
const RELATED_FETCH_CHUNK = 300;

/**
 * Bulk-fetch related rows for a whole-layer export, dispatching on `fetchMode`.
 *
 * - parquet: read the entire related asset in one shot — it's already scoped to
 *   the STAC item, so every row belongs to this layer (no per-key filtering, no
 *   URL to overflow).
 * - postgrest/wfs: the table may be shared across datasets and the server caps
 *   unfiltered responses, so we KEEP the join-key filter but split it into
 *   chunks. One giant `in.(…thousands…)` URL is what triggers net::ERR_FAILED.
 */
export async function fetchRelatedRowsBulk(config: RelatedTable, values: string[]): Promise<PostgRESTRow[]> {
    if (config.fetchMode === 'parquet' && config.url) {
        // Lazy import keeps duckdb off the initial bundle.
        const { queryParquetAll } = await import('@/lib/duckdb/client');
        return queryParquetAll({
            url: config.url,
            sortBy: config.sortBy,
            sortDirection: config.sortDirection,
        });
    }

    const unique = [...new Set(values.filter(Boolean))];
    if (!config.matchingField || unique.length === 0) return [];

    const out: PostgRESTRow[] = [];
    for (let i = 0; i < unique.length; i += RELATED_FETCH_CHUNK) {
        out.push(...await fetchRelatedRows(config, unique.slice(i, i + RELATED_FETCH_CHUNK)));
    }
    return out;
}

/** Group rows by `matchingField` value — mirrors the PostgREST join semantics used by popups. */
export function groupRelatedRows(rows: PostgRESTRow[], matchingField: string): Map<string, PostgRESTRow[]> {
    const map = new Map<string, PostgRESTRow[]>();
    for (const row of rows) {
        const key = String(row[matchingField] ?? '');
        if (!key) continue;
        const existing = map.get(key) || [];
        existing.push(row);
        map.set(key, existing);
    }
    return map;
}

function formatDisplayValue(row: PostgRESTRow, df: DisplayField): unknown {
    const formatted = formatNumeric(row[df.field], df.format);
    if (!df.transform) return formatted;
    const result = df.transform(formatted);
    if (isValidElement(result)) {
        const props = result.props as { to?: string; href?: string };
        return props.to || props.href || formatted;
    }
    return result;
}

/**
 * Flatten fetched related rows to a CSV string. Uses `displayFields` (label
 * order) when configured, else dumps every raw column from the first row.
 */
export function relatedRowsToCsv(rows: PostgRESTRow[], table: RelatedTable): string {
    const displayFields = table.displayFields || [];
    if (displayFields.length === 0) {
        const headers = Object.keys(rows[0] || {});
        return buildCSV(rows, headers, (row, header) => row[header] ?? '');
    }

    // Prepend the join key so bulk-exported related rows can be tied back to the
    // main features. displayFields are presentation-oriented and often omit it
    // (e.g. Core Boxes lists box/formation but not uwi).
    const joinKey = table.matchingField;
    const includeJoinKey = !!joinKey && !displayFields.some(df => df.field === joinKey);
    const headers = [
        ...(includeJoinKey ? [joinKey] : []),
        ...displayFields.map(df => df.label || df.field),
    ];
    return buildCSV(rows, headers, (row, header) => {
        if (includeJoinKey && header === joinKey) return row[joinKey] ?? '';
        const df = displayFields.find(d => (d.label || d.field) === header);
        return df ? formatDisplayValue(row, df) : '';
    });
}
