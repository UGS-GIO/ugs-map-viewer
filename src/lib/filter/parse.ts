/**
 * Parse a persisted CQL string back into a {@link FilterState}. Relies on the
 * shape we emit via {@link toCql} — we don't attempt to parse arbitrary CQL.
 */
import type {
    FilterFieldKind,
    FilterSchema,
    FilterState,
    FilterFieldValue,
} from './types';
import { emptyFilterState, emptyFieldValue } from './types';

const eqValuesForField = (cql: string, field: string): string[] => {
    const pattern = new RegExp(`${field}\\s*=\\s*'((?:[^']|'')*)'`, 'g');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(cql)) !== null) out.push(m[1].replace(/''/g, "'"));
    return out;
};

const likeValuesForField = (cql: string, field: string): string[] => {
    const pattern = new RegExp(`${field}\\s+LIKE\\s+'%((?:[^%']|'')*)%'`, 'g');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(cql)) !== null) out.push(m[1].replace(/''/g, "'"));
    return out;
};

const parseFieldValue = (field: FilterFieldKind, cql: string): FilterFieldValue => {
    switch (field.kind) {
        case 'multiSelect':
            return { kind: 'multiSelect', values: eqValuesForField(cql, field.field) };
        case 'containsAny':
            return { kind: 'containsAny', values: likeValuesForField(cql, field.field) };
        case 'range': {
            const minMatch = cql.match(new RegExp(`${field.field}\\s*>=\\s*(-?\\d+(?:\\.\\d+)?)`));
            const maxMatch = cql.match(new RegExp(`${field.field}\\s*<=\\s*(-?\\d+(?:\\.\\d+)?)`));
            return {
                kind: 'range',
                min: minMatch ? Number(minMatch[1]) : null,
                max: maxMatch ? Number(maxMatch[1]) : null,
            };
        }
        case 'boolean': {
            const trueLit = field.trueValue ?? 'True';
            const falseLit = field.falseValue ?? 'False';
            if (cql.includes(`${field.field} = '${trueLit}'`)) return { kind: 'boolean', value: 'yes' };
            if (cql.includes(`${field.field} = '${falseLit}'`)) return { kind: 'boolean', value: 'no' };
            return { kind: 'boolean', value: 'all' };
        }
    }
};

export const fromCql = (schema: FilterSchema, cql: string | null | undefined): FilterState => {
    if (!cql) return emptyFilterState(schema);
    const state: FilterState = {};
    for (const f of schema.fields) {
        state[f.field] = cql ? parseFieldValue(f, cql) : emptyFieldValue(f);
    }
    return state;
};
