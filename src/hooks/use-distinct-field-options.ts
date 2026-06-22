/**
 * Fetches distinct values for one field, constrained by the rest of the
 * filter state so the option list cascades (selecting a county narrows the
 * operator options to those present in that county).
 *
 * The field itself is excluded from the predicate so its own current
 * selection doesn't remove it from its own options.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { FilterSchema, FilterState, FilterFieldKind } from '@/lib/filter/types';
import { toPostgrestPredicates } from '@/lib/filter/generators';

interface Options {
    schema: FilterSchema;
    state: FilterState;
    field: FilterFieldKind;
    /** Set true for `containsAny` fields: row values are comma-delimited, post-split + dedupe. */
    splitCommaDelimited?: boolean;
    enabled?: boolean;
}

const buildUrl = (schema: FilterSchema, field: FilterFieldKind, state: FilterState): string => {
    const predicates = toPostgrestPredicates(schema, state, field.field);
    const parts = [
        `select=${field.field}`,
        `${field.field}=not.is.null`,
        `${field.field}=neq.`,
        `order=${field.field}.asc`,
        ...predicates,
    ];
    return `${schema.tableUrl}?${parts.join('&')}`;
};

export const useDistinctFieldOptions = ({
    schema,
    state,
    field,
    splitCommaDelimited = false,
    enabled = true,
}: Options) => {
    const url = buildUrl(schema, field, state);

    return useQuery({
        queryKey: ['distinct-field-options', schema.recordKey, field.field, url],
        queryFn: async (): Promise<{ options: string[]; counts: Record<string, number> }> => {
            const res = await fetch(url, {
                headers: { Accept: 'application/json', ...(schema.tableHeaders ?? {}) },
            });
            if (!res.ok) throw new Error(`Failed to fetch distinct ${field.field}`);
            const rows: Record<string, string>[] = await res.json();
            const seen = new Set<string>();
            const out: string[] = [];
            // Per-value row counts, tallied from the same rows we already fetched —
            // free, and cascaded by the other active filters (the predicate excludes
            // only this field's own selection).
            const counts: Record<string, number> = {};
            const tally = (v: string) => {
                if (!v) return;
                if (!seen.has(v)) { seen.add(v); out.push(v); }
                counts[v] = (counts[v] ?? 0) + 1;
            };
            for (const row of rows) {
                const raw = row[field.field];
                if (typeof raw !== 'string') continue;
                if (splitCommaDelimited) {
                    for (const part of raw.split(',')) tally(part.trim());
                } else {
                    tally(raw.trim());
                }
            }
            if (splitCommaDelimited) out.sort();
            return { options: out, counts };
        },
        enabled,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5,
    });
};
