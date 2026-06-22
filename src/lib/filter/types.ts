/**
 * Declarative layer filter framework.
 *
 * A layer declares a `FilterSchema` (its filterable fields + kinds). The
 * framework derives state, CQL (GeoServer WMS/WFS), MapLibre expression
 * filters (client-side vector), PostgREST predicates (distinct-option
 * fetches), and a schema-driven UI component from the same schema.
 */

import type { YesNoAll } from '@/components/sidebar/filter/boolean-filter';

export type FilterFieldKind =
    /** One-of multi-select. Matches equality against one of N values. */
    | {
        kind: 'multiSelect';
        field: string;
        label: string;
        placeholder?: string;
        /** When set, UI renders as a checkbox grid with color swatches. */
        optionSwatches?: Record<string, string>;
        /** Visual stroke color per option, mirrors `circleStrokeColorMatch`. */
        optionStrokes?: Record<string, string>;
        /** Optional label overrides for each value (e.g. skip 'Other / Unknown'). */
        optionLabelFilter?: (label: string) => boolean;
    }
    /** Substring match against a comma-delimited column (e.g. `box_type_codes`). */
    | {
        kind: 'containsAny';
        field: string;
        label: string;
        placeholder?: string;
        /** When set, UI renders as a checkbox grid with color swatches. */
        optionSwatches?: Record<string, string>;
        /** Visual stroke color per option. */
        optionStrokes?: Record<string, string>;
        /** Optional label filter to hide certain options. */
        optionLabelFilter?: (label: string) => boolean;
    }
    /** Numeric min/max range. */
    | {
        kind: 'range';
        field: string;
        label: string;
        units?: string;
        step?: number;
        /** Round extent bounds to nearest `step` for snap-feel. */
        snapStep?: number;
    }
    /** Three-state yes/no/all boolean. */
    | {
        kind: 'boolean';
        field: string;
        label: string;
        /** Stringified DB values for the yes/no branches (e.g. 'True'/'False'). */
        trueValue?: string;
        falseValue?: string;
        /** When set, the filter is rendered read-only with this tooltip. */
        disabled?: { message?: string };
    };

export interface FilterSchema {
    /** Key under `search.filters[recordKey]` where the CQL lives. */
    recordKey: string;
    /** PostgREST base URL for distinct-option / range-extent queries. */
    tableUrl: string;
    /** Extra headers to send with PostgREST requests. */
    tableHeaders?: Record<string, string>;
    /** Ordered field list. Renders top-to-bottom in the UI. */
    fields: FilterFieldKind[];
}

// ─── State ───────────────────────────────────────────────────────────────────

export type FilterFieldValue =
    | { kind: 'multiSelect'; values: string[] }
    | { kind: 'containsAny'; values: string[] }
    | { kind: 'range'; min: number | null; max: number | null }
    | { kind: 'boolean'; value: YesNoAll };

/** Keyed by field name (not by kind). */
export type FilterState = Record<string, FilterFieldValue>;

export const emptyFieldValue = (field: FilterFieldKind): FilterFieldValue => {
    switch (field.kind) {
        case 'multiSelect':
        case 'containsAny':
            return { kind: field.kind, values: [] };
        case 'range':
            return { kind: 'range', min: null, max: null };
        case 'boolean':
            return { kind: 'boolean', value: 'all' };
    }
};

export const emptyFilterState = (schema: FilterSchema): FilterState => {
    const state: FilterState = {};
    for (const f of schema.fields) state[f.field] = emptyFieldValue(f);
    return state;
};

/** True if no filter is active on any field. */
export const isFilterEmpty = (state: FilterState): boolean => {
    for (const value of Object.values(state)) {
        switch (value.kind) {
            case 'multiSelect':
            case 'containsAny':
                if (value.values.length > 0) return false;
                break;
            case 'range':
                if (value.min != null || value.max != null) return false;
                break;
            case 'boolean':
                if (value.value !== 'all') return false;
                break;
        }
    }
    return true;
};
