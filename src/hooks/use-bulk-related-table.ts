import { RelatedTable } from "@/lib/types/mapping-types";
import type { PostgRESTRow } from '@/lib/types/postgrest-types';
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from '@/lib/query-keys';
import { fetchRelatedRows, groupRelatedRows } from '@/lib/related-table-fetch';

// Map of targetValue -> array of related rows (supports multiple matches like formation tops)
export type RelatedDataMap = Map<string, PostgRESTRow[]>;

export const EMPTY_RELATED_DATA_MAP: RelatedDataMap = new Map();

interface BulkRelatedResult {
    /** Map of targetValue -> related row data for each related table */
    dataByTable: RelatedDataMap[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Fetches all related table data in bulk for a set of target values.
 * Returns a map for each related table: targetValue -> row data
 */
export function useBulkRelatedTable(
    relatedTables: RelatedTable[] | undefined,
    targetValues: string[]
): BulkRelatedResult {
    const configs = relatedTables || [];

    // Create a stable key from unique target values
    const uniqueValues = [...new Set(targetValues.filter(Boolean))];
    const valuesKey = uniqueValues.sort().join(',');

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.features.bulkRelatedTable(
            configs.map(c => c.url).join('|'),
            valuesKey
        ),
        queryFn: async (): Promise<RelatedDataMap[]> => {
            if (configs.length === 0 || uniqueValues.length === 0) {
                return configs.map(() => new Map());
            }

            // Two relatedTable configs can resolve to the same underlying asset (e.g. "Core
            // Boxes" and "Sample Types" both read enmin_ucrc_boxes via stacAsset) — dedupe by
            // url+matchingField so the same parquet isn't read through duckdb twice per popup.
            const fetchCache = new Map<string, Promise<RelatedDataMap>>();

            const results = await Promise.all(
                configs.map((config): Promise<RelatedDataMap> => {
                    // STAC-backed entries are resolved to a full url/matchingField before reaching
                    // here; bail if a config is missing the join column either way.
                    const matchingField = config.matchingField;
                    if (!matchingField || !config.url) return Promise.resolve(new Map());

                    const cacheKey = `${config.fetchMode ?? 'postgrest'}|${config.url}|${matchingField}`;
                    let cached = fetchCache.get(cacheKey);
                    if (!cached) {
                        cached = (async (): Promise<RelatedDataMap> => {
                            try {
                                const rows = await fetchRelatedRows(config, uniqueValues);
                                // Map: matchingField value -> array of rows (supports multiple
                                // matches like formation tops per well).
                                return groupRelatedRows(rows, matchingField);
                            } catch (err) {
                                console.error(`Error fetching bulk related table:`, err);
                                return new Map();
                            }
                        })();
                        fetchCache.set(cacheKey, cached);
                    }
                    return cached;
                })
            );

            return results;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
        enabled: configs.length > 0 && uniqueValues.length > 0,
    });

    return {
        dataByTable: data || configs.map(() => new Map()),
        isLoading,
        error: error as Error | null,
    };
}

/**
 * Format a single row's displayFields
 */
function formatRowDisplayFields(
    row: PostgRESTRow,
    relatedTable: RelatedTable
): string {
    if (relatedTable.displayFields && relatedTable.displayFields.length > 0) {
        return relatedTable.displayFields
            .map(df => {
                const rawValue = row[df.field];
                let value: string;

                if (df.transform) {
                    const transformed = df.transform(String(rawValue ?? ''));
                    value = typeof transformed === 'string' ? transformed : String(rawValue ?? '');
                } else {
                    value = String(rawValue ?? '');
                }

                if (!value) return '';

                // If displayField has a label, format as "label: value"
                // Otherwise just return the value (like liquefaction's description)
                return df.label ? `${df.label}: ${value}` : value;
            })
            .filter(Boolean)
            .join(' | ');
    }

    // Fallback: return first non-id field
    const keys = Object.keys(row).filter(k =>
        k !== relatedTable.matchingField &&
        k !== 'id' &&
        !k.endsWith('_id')
    );
    return keys.length > 0 ? String(row[keys[0]] ?? '') : '';
}

/**
 * Get the display value for a related table given a target value.
 * Formats multiple displayFields with their labels like the popup does.
 * Handles multiple rows per target value (e.g., formation tops).
 */
export function getRelatedDisplayValue(
    relatedTable: RelatedTable,
    dataMap: RelatedDataMap,
    targetValue: string | undefined
): string {
    if (!targetValue) return '';

    const rows = dataMap.get(targetValue);
    if (!rows || rows.length === 0) return '';

    // Format each row and join with newlines for multiple rows
    const formattedRows = rows.map(row => formatRowDisplayFields(row, relatedTable)).filter(Boolean);

    // For single row, just return it
    // For multiple rows, join with semicolon
    return formattedRows.join('; ');
}
