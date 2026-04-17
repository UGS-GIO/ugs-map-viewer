import type { ExpressionSpecification } from 'maplibre-gl';
import type { YesNoAll } from '@/components/sidebar/filter/boolean-filter';
import { escapeCqlLiteral } from '@/lib/cql-utils';

export interface UCRCFilterState {
    purposes: Set<string>;
    counties: string[];
    operators: string[];
    fields: string[];
    formations: string[];
    depthMin: number | null;
    depthMax: number | null;
    hasPhotos: YesNoAll;
    boxTypes: string[];
}

export const emptyUCRCFilterState = (): UCRCFilterState => ({
    purposes: new Set(),
    counties: [],
    operators: [],
    fields: [],
    formations: [],
    depthMin: null,
    depthMax: null,
    hasPhotos: 'all',
    boxTypes: [],
});

// ─── CQL parsing (URL ↔ state) ───────────────────────────────────────────────

/** Extract all quoted values for a given CQL field, e.g. "county = 'FOO'" → ['FOO']. Handles '' escapes. */
const extractCqlValues = (cql: string, field: string): string[] => {
    const pattern = new RegExp(`${field}\\s*=\\s*'((?:[^']|'')*)'`, 'g');
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cql)) !== null) {
        results.push(match[1].replace(/''/g, "'"));
    }
    return results;
};

/** Extract values from `${field} LIKE '%value%'` clauses (for comma-separated columns). */
const extractCqlLikeValues = (cql: string, field: string): string[] => {
    const pattern = new RegExp(`${field}\\s+LIKE\\s+'%((?:[^%']|'')*)%'`, 'g');
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cql)) !== null) {
        results.push(match[1].replace(/''/g, "'"));
    }
    return results;
};

export const parseUCRCFilter = (cql: string | null | undefined): UCRCFilterState => {
    const state = emptyUCRCFilterState();
    if (!cql) return state;

    state.purposes = new Set(extractCqlValues(cql, 'purpose'));
    state.counties = extractCqlValues(cql, 'county');
    state.operators = extractCqlValues(cql, 'current_operator');
    state.fields = extractCqlValues(cql, 'field_name');
    state.formations = extractCqlValues(cql, 'producing_formation');
    state.boxTypes = extractCqlLikeValues(cql, 'box_type_codes');

    const depthMinMatch = cql.match(/td_ft\s*>=\s*(\d+)/);
    if (depthMinMatch) state.depthMin = Number(depthMinMatch[1]);

    const depthMaxMatch = cql.match(/td_ft\s*<=\s*(\d+)/);
    if (depthMaxMatch) state.depthMax = Number(depthMaxMatch[1]);

    if (cql.includes("has_photos = 'True'")) state.hasPhotos = 'yes';
    else if (cql.includes("has_photos = 'False'")) state.hasPhotos = 'no';

    return state;
};

// ─── CQL generation (state → URL) ────────────────────────────────────────────

/** Build a CQL OR clause for a multi-value field, e.g. "(county = 'A' OR county = 'B')" */
const buildCqlOrClause = (field: string, values: string[]): string | null => {
    if (values.length === 0) return null;
    const parts = values.map(v => `${field} = '${escapeCqlLiteral(v)}'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

/** Build a CQL OR-of-LIKEs for a comma-separated text column, e.g. "(box_type_codes LIKE '%A%' OR ...)" */
const buildCqlLikeAnyClause = (field: string, values: string[]): string | null => {
    if (values.length === 0) return null;
    const parts = values.map(v => `${field} LIKE '%${escapeCqlLiteral(v)}%'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

export const generateUCRCFilter = (state: UCRCFilterState): string => {
    const boolFilter = (field: string, value: YesNoAll): string | null => {
        if (value === 'yes') return `${field} = 'True'`;
        if (value === 'no') return `${field} = 'False'`;
        return null;
    };

    const parts: (string | null)[] = [
        buildCqlOrClause('purpose', Array.from(state.purposes)),
        buildCqlOrClause('county', state.counties),
        buildCqlOrClause('current_operator', state.operators),
        buildCqlOrClause('field_name', state.fields),
        buildCqlOrClause('producing_formation', state.formations),
        state.depthMin != null ? `td_ft >= ${state.depthMin}` : null,
        state.depthMax != null ? `td_ft <= ${state.depthMax}` : null,
        boolFilter('has_photos', state.hasPhotos),
        buildCqlLikeAnyClause('box_type_codes', state.boxTypes),
    ];

    return parts.filter(Boolean).join(' AND ');
};

// ─── MapLibre filter generation (state → vector layer filter) ────────────────
//
// We construct only modern expression-style filters (ExpressionSpecification),
// which are a subset of FilterSpecification accepted by Layer.filter.
// Maplibre-gl's tuple types for `match`/`all`/`any` are too narrow to infer
// from `Object.entries(...).flat()` and similar patterns, so we keep the
// internal type loose and cast at the public boundary.

type ExprArg = string | number | boolean | null | unknown[];

const inAnyOf = (field: string, values: string[]): unknown[] | null =>
    values.length === 0 ? null : ['in', ['get', field], ['literal', values]];

/** Comma-separated column substring match: any requested value appears in the column */
const containsAny = (field: string, values: string[]): unknown[] | null => {
    if (values.length === 0) return null;
    const clauses: unknown[][] = values.map(v =>
        ['>=', ['index-of', v as ExprArg, ['coalesce', ['get', field], '']], 0]
    );
    return clauses.length === 1 ? clauses[0] : ['any', ...clauses];
};

export const generateUCRCMaplibreFilter = (state: UCRCFilterState): ExpressionSpecification | null => {
    const clauses: unknown[][] = [];

    const purposesArr = Array.from(state.purposes);
    const push = (clause: unknown[] | null) => { if (clause) clauses.push(clause); };

    push(inAnyOf('purpose', purposesArr));
    push(inAnyOf('county', state.counties));
    push(inAnyOf('current_operator', state.operators));
    push(inAnyOf('field_name', state.fields));
    push(inAnyOf('producing_formation', state.formations));

    if (state.depthMin != null) clauses.push(['>=', ['coalesce', ['get', 'td_ft'], 0], state.depthMin]);
    if (state.depthMax != null) clauses.push(['<=', ['coalesce', ['get', 'td_ft'], Number.MAX_SAFE_INTEGER], state.depthMax]);

    if (state.hasPhotos === 'yes') clauses.push(['==', ['get', 'has_photos'], 'True']);
    else if (state.hasPhotos === 'no') clauses.push(['==', ['get', 'has_photos'], 'False']);

    push(containsAny('box_type_codes', state.boxTypes));

    if (clauses.length === 0) return null;
    const expr: unknown[] = clauses.length === 1 ? clauses[0] : ['all', ...clauses];
    return expr as unknown as ExpressionSpecification;
};
