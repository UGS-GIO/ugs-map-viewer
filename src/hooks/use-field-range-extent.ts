/**
 * Fetches a numeric field's global min/max for a range-slider extent. Kept
 * unfiltered so the slider's rails don't shrink underneath the user when
 * they apply other filters.
 */
import { useQuery } from '@tanstack/react-query';
import type { FilterSchema, FilterFieldKind } from '@/lib/filter/types';

interface Options {
    schema: FilterSchema;
    field: Extract<FilterFieldKind, { kind: 'range' }>;
    enabled?: boolean;
}

export const useFieldRangeExtent = ({ schema, field, enabled = true }: Options) => {
    return useQuery({
        queryKey: ['field-range-extent', schema.recordKey, field.field],
        queryFn: async (): Promise<{ min: number; max: number }> => {
            const headers = { Accept: 'application/json', ...(schema.tableHeaders ?? {}) };
            const common = `select=${field.field}&${field.field}=not.is.null`;
            const [minRes, maxRes] = await Promise.all([
                fetch(`${schema.tableUrl}?${common}&order=${field.field}.asc&limit=1`, { headers }),
                fetch(`${schema.tableUrl}?${common}&order=${field.field}.desc&limit=1`, { headers }),
            ]);
            if (!minRes.ok || !maxRes.ok) throw new Error(`Failed to fetch ${field.field} range`);
            const [minRows, maxRows]: [Record<string, number>[], Record<string, number>[]] = await Promise.all([
                minRes.json(),
                maxRes.json(),
            ]);
            const rawMin = minRows[0]?.[field.field] ?? 0;
            const rawMax = maxRows[0]?.[field.field] ?? 0;
            const snap = field.snapStep;
            return snap && snap > 0
                ? { min: Math.floor(rawMin / snap) * snap, max: Math.ceil(rawMax / snap) * snap }
                : { min: rawMin, max: rawMax };
        },
        enabled,
        staleTime: 1000 * 60 * 60,
    });
};
