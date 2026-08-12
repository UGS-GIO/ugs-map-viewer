/**
 * Fetches a numeric field's global min/max for a range-slider extent. Kept
 * unfiltered so the slider's rails don't shrink underneath the user when
 * they apply other filters.
 */
import { useQuery } from '@tanstack/react-query';
import type { FilterSchema, FilterFieldKind } from '@/lib/filter/types';
import { useSchemaParquetUrl } from '@/hooks/use-schema-parquet-url';

interface Options {
    schema: FilterSchema;
    field: Extract<FilterFieldKind, { kind: 'range' }>;
    enabled?: boolean;
}

const snapped = (
    { min, max }: { min: number; max: number },
    snap: number | undefined,
): { min: number; max: number } => (snap && snap > 0
    ? { min: Math.floor(min / snap) * snap, max: Math.ceil(max / snap) * snap }
    : { min, max });

export const useFieldRangeExtent = ({ schema, field, enabled = true }: Options) => {
    const { parquetUrl } = useSchemaParquetUrl(schema);

    const parquetQuery = useQuery({
        queryKey: ['field-range-extent', 'parquet', parquetUrl, field.field],
        queryFn: async (): Promise<{ min: number; max: number }> => {
            const { queryParquetFieldExtent } = await import('@/lib/duckdb/client');
            return snapped(await queryParquetFieldExtent({ url: parquetUrl!, field: field.field }), field.snapStep);
        },
        enabled: enabled && !!parquetUrl,
        staleTime: 1000 * 60 * 60,
    });

    const postgrestQuery = useQuery({
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
            return snapped({ min: rawMin, max: rawMax }, field.snapStep);
        },
        enabled: enabled && !schema.stacItemId,
        staleTime: 1000 * 60 * 60,
    });

    return schema.stacItemId ? parquetQuery : postgrestQuery;
};
