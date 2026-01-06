import { RelatedTable } from "@/lib/types/mapping-types";
import type { PostgRESTRow } from '@/lib/types/postgrest-types';
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from '@/lib/query-keys';

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

            const results = await Promise.all(
                configs.map(async (config): Promise<RelatedDataMap> => {
                    try {
                        // Use PostgREST 'in' operator to fetch only matching rows
                        // e.g., ?relate_id=in.(value1,value2,value3)
                        const inValues = uniqueValues.join(',');
                        const queryUrl = `${config.url}?${config.matchingField}=in.(${inValues})`;

                        const response = await fetch(queryUrl, {
                            headers: config.headers,
                        });

                        if (!response.ok) {
                            console.error(`[useBulkRelatedTable] fetch failed: ${response.status}`);
                            return new Map();
                        }

                        const data = await response.json();
                        const rows = Array.isArray(data) ? data : [data];

                        // Build a map: matchingField value -> array of rows
                        // (supports multiple matches like formation tops per well)
                        const map = new Map<string, PostgRESTRow[]>();
                        for (const row of rows) {
                            const key = String(row[config.matchingField] ?? '');
                            if (key) {
                                const existing = map.get(key) || [];
                                existing.push(row);
                                map.set(key, existing);
                            }
                        }

                        return map;
                    } catch (err) {
                        console.error(`Error fetching bulk related table:`, err);
                        return new Map();
                    }
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
