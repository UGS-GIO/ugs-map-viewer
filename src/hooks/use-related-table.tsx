import { RelatedTable } from "@/lib/types/mapping-types";
import type { PostgRESTRow } from '@/lib/types/postgrest-types';
import { useQueries, UseQueryResult } from "@tanstack/react-query";
import { Feature, Geometry, GeoJsonProperties } from "geojson";
import { queryKeys } from '@/lib/query-keys';

type RelatedData = PostgRESTRow;

interface LabelValuePair {
    label: string | undefined;
    value: string | number | boolean | null;
}

export type ProcessedRelatedData = RelatedData & {
    labelValuePairs?: LabelValuePair[];
};

type CombinedResult = {
    data: ProcessedRelatedData[][];
    isLoading: boolean;
    error: Error | null;
};

const useRelatedTable = (
    configs: RelatedTable[],
    feature: Feature<Geometry, GeoJsonProperties> | null
): CombinedResult => {
    const queryResults: UseQueryResult<ProcessedRelatedData[]>[] = useQueries({
        queries: configs.map((config, index) => ({
            queryKey: queryKeys.features.relatedTable(config.url, feature?.properties?.[config.targetField] || '', config.targetField),
            queryFn: async (): Promise<ProcessedRelatedData[]> => {
                try {
                    const targetValue = feature?.properties?.[config.targetField];
                    const logicalOperator = config.logicalOperator || 'eq';

                    // If no target value and it's required, return empty array
                    if (!targetValue && config.targetField) {
                        return [];
                    }

                    const queryUrl = targetValue
                        ? `${config.url}?${config.matchingField}=${logicalOperator}.${targetValue}${config.sortBy ? `&order=${config.sortBy}.${config.sortDirection || 'asc'}` : ''}`
                        : config.url;

                    const response = await fetch(queryUrl, {
                        headers: config.headers,
                    });

                    if (!response.ok) {
                        console.error(`QUERY ${index}: Request failed with status ${response.status}: ${response.statusText}`);
                        throw new Error(
                            `Failed to fetch related table for ${config.targetField}: ${response.statusText}`
                        );
                    }

                    const data = await response.json();
                    const rawData = Array.isArray(data) ? data : [data];

                    if (config.displayFields) {
                        const result = rawData.map(item => {
                            // Create label-value pairs for each field specified in displayFields
                            const labelValuePairs = config.displayFields!.map(df => {
                                const transformedvalue = df.transform ? df.transform(item[df.field]) : item[df.field];
                                const value = transformedvalue ?? 'N/A';
                                return {
                                    label: df.label,
                                    value: value
                                };
                            });

                            return {
                                ...item,
                                labelValuePairs,
                            };
                        });
                        return result;
                    }

                    return rawData;
                } catch (error) {
                    console.error(`QUERY ${index}: Error fetching related table for ${config.targetField}:`, error);
                    throw error;
                }
            },
            staleTime: 1000 * 60 * 60, // 1 hour
            enabled: Boolean(feature) &&
                (config.targetField ? Boolean(feature?.properties?.[config.targetField]) : true),
            retry: 2, // Retry failed queries twice
            retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        })),
    });

    const combinedResult: CombinedResult = {
        data: queryResults.map((result) => {
            return result.data ?? [];
        }),
        isLoading: queryResults.some(result => result.isLoading),
        error: queryResults.find(result => result.error)?.error || null,
    };

    return combinedResult;
};

export { useRelatedTable };