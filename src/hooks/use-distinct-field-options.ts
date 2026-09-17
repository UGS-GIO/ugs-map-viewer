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
import { toPostgrestPredicates, toSqlPredicates } from '@/lib/filter/generators';
import { useSchemaParquetUrl } from '@/hooks/use-schema-parquet-url';

/** `counts` honour the current filter (minus this field's own selection); `totals` ignore it. */
interface FieldOptions {
    options: string[];
    counts: Record<string, number>;
    totals: Record<string, number>;
}

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
    const { parquetUrl, isResolving } = useSchemaParquetUrl(schema);
    const url = buildUrl(schema, field, state);
    const predicates = parquetUrl ? toSqlPredicates(schema, state, field.field) : [];

    const parquetQuery = useQuery({
        queryKey: ['distinct-field-options', 'parquet', parquetUrl, field.field, predicates, splitCommaDelimited],
        queryFn: async (): Promise<FieldOptions> => {
            const { queryParquetFieldOptions } = await import('@/lib/duckdb/client');
            return queryParquetFieldOptions({ url: parquetUrl!, field: field.field, predicates, splitCommaDelimited });
        },
        enabled: enabled && !!parquetUrl,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5,
    });

    const postgrestQuery = useQuery({
        queryKey: ['distinct-field-options', schema.recordKey, field.field, url],
        queryFn: async (): Promise<FieldOptions> => {
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
            // PostgREST fetches the filtered rows only, so there is no cross-field total to show.
            return { options: out, counts, totals: counts };
        },
        enabled: enabled && !schema.stacItemId,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5,
    });

    if (schema.stacItemId) {
        return { ...parquetQuery, isLoading: parquetQuery.isLoading || isResolving };
    }
    return postgrestQuery;
};
