/**
 * URL-synced filter-state manager. Stores the CQL encoding under
 * `search.filters[schema.recordKey]` so it can be shared as a link; derives
 * the live {@link FilterState} via {@link fromCql} on each render.
 */
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { FilterSchema, FilterState, FilterFieldValue } from '@/lib/filter/types';
import { isFilterEmpty } from '@/lib/filter/types';
import { toCql } from '@/lib/filter/generators';
import { fromCql } from '@/lib/filter/parse';

export interface LayerFilterManager {
    schema: FilterSchema;
    state: FilterState;
    setField: (field: string, value: FilterFieldValue) => void;
    clearAll: () => void;
    hasAnyFilter: boolean;
    cql: string;
}

export const useLayerFilter = (schema: FilterSchema): LayerFilterManager => {
    const navigate = useNavigate();
    const search = useSearch({ strict: false });

    const cql = useMemo(() => {
        const filters = search.filters;
        if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return '';
        if (!(schema.recordKey in filters)) return '';
        const v = Reflect.get(filters, schema.recordKey);
        return typeof v === 'string' ? v : '';
    }, [search.filters, schema.recordKey]);

    const state = useMemo(() => fromCql(schema, cql), [schema, cql]);

    const writeCql = useCallback((next: string) => {
        navigate({
            to: '.',
            search: (prev: Record<string, unknown>) => {
                const prevFilters = prev.filters;
                const current = prevFilters && typeof prevFilters === 'object' && !Array.isArray(prevFilters)
                    ? { ...(prevFilters as Record<string, string>) }
                    : {};
                if (next) {
                    current[schema.recordKey] = next;
                } else {
                    delete current[schema.recordKey];
                }
                return {
                    ...prev,
                    filters: Object.keys(current).length > 0 ? current : undefined,
                };
            },
            replace: true,
        });
    }, [navigate, schema.recordKey]);

    const setField = useCallback((field: string, value: FilterFieldValue) => {
        const nextState = { ...state, [field]: value };
        writeCql(toCql(schema, nextState));
    }, [state, schema, writeCql]);

    const clearAll = useCallback(() => writeCql(''), [writeCql]);

    return {
        schema,
        state,
        setField,
        clearAll,
        hasAnyFilter: !isFilterEmpty(state),
        cql,
    };
};
