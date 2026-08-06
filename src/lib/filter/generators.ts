/**
 * Generators convert a {@link FilterState} against a {@link FilterSchema} into
 * the three representations we need:
 *  1. CQL — for GeoServer WMS/WFS `cql_filter` and URL persistence
 *  2. MapLibre ExpressionSpecification — for client-side vector layer filter
 *  3. PostgREST predicates — for cascading distinct-option fetches
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { escapeCqlLiteral } from '@/lib/cql-utils';
import type {
    FilterFieldKind,
    FilterSchema,
    FilterState,
} from './types';

// ─── CQL ─────────────────────────────────────────────────────────────────────

const cqlOrClause = (field: string, values: string[]): string | null => {
    if (values.length === 0) return null;
    const parts = values.map(v => `${field} = '${escapeCqlLiteral(v)}'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

const cqlLikeAnyClause = (field: string, values: string[]): string | null => {
    if (values.length === 0) return null;
    const parts = values.map(v => `${field} LIKE '%${escapeCqlLiteral(v)}%'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

const fieldToCql = (field: FilterFieldKind, state: FilterState): string | null => {
    const v = state[field.field];
    if (!v) return null;
    switch (field.kind) {
        case 'multiSelect':
            return v.kind === 'multiSelect' ? cqlOrClause(field.field, v.values) : null;
        case 'containsAny':
            return v.kind === 'containsAny' ? cqlLikeAnyClause(field.field, v.values) : null;
        case 'range': {
            if (v.kind !== 'range') return null;
            const parts: string[] = [];
            if (v.min != null) parts.push(`${field.field} >= ${v.min}`);
            if (v.max != null) parts.push(`${field.field} <= ${v.max}`);
            return parts.length > 0 ? parts.join(' AND ') : null;
        }
        case 'boolean': {
            if (v.kind !== 'boolean' || v.value === 'all') return null;
            const lit = v.value === 'yes' ? field.trueValue ?? 'True' : field.falseValue ?? 'False';
            return `${field.field} = '${escapeCqlLiteral(lit)}'`;
        }
    }
};

export const toCql = (schema: FilterSchema, state: FilterState): string => {
    const parts: string[] = [];
    for (const f of schema.fields) {
        const c = fieldToCql(f, state);
        if (c) parts.push(c);
    }
    return parts.join(' AND ');
};

// ─── MapLibre ────────────────────────────────────────────────────────────────
//
// Tuple types on maplibre's `match`/`in`/`any` are too narrow to infer from
// spread-built arrays. We keep the internal shape loose and cast once at the
// public boundary.

type Expr = unknown[];

const inAnyOf = (field: string, values: string[]): Expr | null =>
    values.length === 0 ? null : ['in', ['get', field], ['literal', values]];

const containsAny = (field: string, values: string[]): Expr | null => {
    if (values.length === 0) return null;
    const clauses: Expr[] = values.map(v =>
        ['>=', ['index-of', v, ['coalesce', ['get', field], '']], 0],
    );
    return clauses.length === 1 ? clauses[0] : ['any', ...clauses];
};

const fieldToMaplibre = (field: FilterFieldKind, state: FilterState): Expr | null => {
    const v = state[field.field];
    if (!v) return null;
    switch (field.kind) {
        case 'multiSelect':
            return v.kind === 'multiSelect' ? inAnyOf(field.field, v.values) : null;
        case 'containsAny':
            return v.kind === 'containsAny' ? containsAny(field.field, v.values) : null;
        case 'range': {
            if (v.kind !== 'range') return null;
            const parts: Expr[] = [];
            if (v.min != null) parts.push(['>=', ['coalesce', ['get', field.field], 0], v.min]);
            if (v.max != null) parts.push(['<=', ['coalesce', ['get', field.field], Number.MAX_SAFE_INTEGER], v.max]);
            if (parts.length === 0) return null;
            return parts.length === 1 ? parts[0] : ['all', ...parts];
        }
        case 'boolean': {
            if (v.kind !== 'boolean' || v.value === 'all') return null;
            // GeoJSON boolean fields come back as real booleans; field.trueValue/falseValue
            // are for PostgREST URL formatting, not maplibre comparisons.
            return ['==', ['get', field.field], v.value === 'yes'];
        }
    }
};

export const toMaplibreFilter = (schema: FilterSchema, state: FilterState): ExpressionSpecification | null => {
    const clauses: Expr[] = [];
    for (const f of schema.fields) {
        const c = fieldToMaplibre(f, state);
        if (c) clauses.push(c);
    }
    if (clauses.length === 0) return null;
    const expr: Expr = clauses.length === 1 ? clauses[0] : ['all', ...clauses];
    return expr as unknown as ExpressionSpecification;
};

// ─── PostgREST ───────────────────────────────────────────────────────────────
//
// PostgREST filter syntax:
//  - equality against list:    col=in.(A,B)
//  - range:                    col=gte.N&col=lte.M
//  - boolean:                  col=eq.True
//  - OR-of-LIKE on one field:  or=(col.ilike.*A*,col.ilike.*B*)
//
// Values embedded in `in.(...)` must URL-encode commas, parens, and quotes.
// PostgREST accepts double-quoted values for escaping, but we rely on
// standard URL encoding via `encodeURIComponent` — each value separately then
// rejoined on literal commas.

const encodeInValue = (v: string): string => {
    // Comma/paren/space must be encoded so they don't terminate the list.
    // PostgREST also accepts double-quoted strings to embed such chars.
    const needsQuote = /[,()"\s]/.test(v);
    const inner = needsQuote ? `"${v.replace(/"/g, '\\"')}"` : v;
    return encodeURIComponent(inner);
};

const encodeLikeValue = (v: string): string => {
    // `*` is PostgREST's LIKE wildcard. Encode commas/parens so they don't
    // break the `or=(...)` grouping.
    return encodeURIComponent(v).replace(/%2A/gi, '*');
};

const fieldToPostgrestParts = (field: FilterFieldKind, state: FilterState): string[] => {
    const v = state[field.field];
    if (!v) return [];
    switch (field.kind) {
        case 'multiSelect':
            if (v.kind !== 'multiSelect' || v.values.length === 0) return [];
            return [`${field.field}=in.(${v.values.map(encodeInValue).join(',')})`];
        case 'containsAny': {
            if (v.kind !== 'containsAny' || v.values.length === 0) return [];
            const clauses = v.values.map(val => `${field.field}.ilike.*${encodeLikeValue(val)}*`);
            return clauses.length === 1
                ? [clauses[0].replace('.ilike.', '=ilike.')]
                : [`or=(${clauses.join(',')})`];
        }
        case 'range': {
            if (v.kind !== 'range') return [];
            const parts: string[] = [];
            if (v.min != null) parts.push(`${field.field}=gte.${v.min}`);
            if (v.max != null) parts.push(`${field.field}=lte.${v.max}`);
            return parts;
        }
        case 'boolean': {
            if (v.kind !== 'boolean' || v.value === 'all') return [];
            const lit = v.value === 'yes' ? field.trueValue ?? 'True' : field.falseValue ?? 'False';
            return [`${field.field}=eq.${encodeURIComponent(lit)}`];
        }
    }
};

/**
 * Build PostgREST query-string predicates from the current filter state,
 * optionally excluding `excludeField` so a field's own option list isn't
 * filtered by its own selection.
 */
export const toPostgrestPredicates = (
    schema: FilterSchema,
    state: FilterState,
    excludeField?: string,
): string[] => {
    const parts: string[] = [];
    for (const f of schema.fields) {
        if (excludeField && f.field === excludeField) continue;
        parts.push(...fieldToPostgrestParts(f, state));
    }
    return parts;
};

const sqlLiteral = (v: string): string => `'${v.replace(/'/g, "''")}'`;
const sqlIdent = (v: string): string => `"${v.replace(/"/g, '""')}"`;

const fieldToSqlParts = (field: FilterFieldKind, state: FilterState): string[] => {
    const v = state[field.field];
    if (!v) return [];
    const col = sqlIdent(field.field);
    switch (field.kind) {
        case 'multiSelect':
            if (v.kind !== 'multiSelect' || v.values.length === 0) return [];
            return [`CAST(${col} AS VARCHAR) IN (${v.values.map(sqlLiteral).join(',')})`];
        case 'containsAny': {
            // Comma-delimited cells: match the same way the option list splits them.
            if (v.kind !== 'containsAny' || v.values.length === 0) return [];
            const clauses = v.values.map(val => `${col} ILIKE ${sqlLiteral(`%${val}%`)}`);
            return [`(${clauses.join(' OR ')})`];
        }
        case 'range': {
            if (v.kind !== 'range') return [];
            const parts: string[] = [];
            if (v.min != null) parts.push(`${col} >= ${Number(v.min)}`);
            if (v.max != null) parts.push(`${col} <= ${Number(v.max)}`);
            return parts;
        }
        case 'boolean': {
            if (v.kind !== 'boolean' || v.value === 'all') return [];
            const lit = v.value === 'yes' ? field.trueValue ?? 'True' : field.falseValue ?? 'False';
            return [`CAST(${col} AS VARCHAR) = ${sqlLiteral(lit)}`];
        }
    }
};

/** SQL counterpart of {@link toPostgrestPredicates}, for querying the layer's geoparquet. */
export const toSqlPredicates = (
    schema: FilterSchema,
    state: FilterState,
    excludeField?: string,
): string[] => {
    const parts: string[] = [];
    for (const f of schema.fields) {
        if (excludeField && f.field === excludeField) continue;
        parts.push(...fieldToSqlParts(f, state));
    }
    return parts;
};
