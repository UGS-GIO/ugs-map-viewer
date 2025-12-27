import { LayerFetchConfig, getLayerFetchConfig, PROD_POSTGREST_URL } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import type { PostgRESTRowOf } from '@/lib/types/postgrest-types';
import { useGetCurrentPage } from "@/hooks/use-get-current-page";
import { queryKeys } from '@/lib/query-keys';

type FeatureAttributes = PostgRESTRowOf<{
    title: string;
    content: string;
}>;

interface CombinedResult {
    data: Record<string, string>;
    isLoading: boolean;
    error: Error | null;
}

const fetchLayerDescriptions = async (configs: LayerFetchConfig[] | null) => {
    if (!configs || configs.length === 0) {
        console.warn("No valid layer fetch configuration found.");
        return [];
    }

    // Fetch from all configs and combine results
    const allResults = await Promise.all(
        configs.map(async ({ tableName, acceptProfile }) => {
            const outfields = 'content,title';
            const url = `${PROD_POSTGREST_URL}/${tableName}?select=${outfields}`;

            const response = await fetch(url, {
                headers: {
                    "Accept-Profile": acceptProfile,
                    "Accept": "application/json",
                    "Cache-Control": "no-cache",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch layer descriptions from ${tableName}: ${response.status} ${response.statusText}`);
            }

            return await response.json() as FeatureAttributes[];
        })
    );

    // Flatten all results into a single array
    return allResults.flat();
};

const useFetchLayerDescriptions = (): CombinedResult => {
    const currentPage = useGetCurrentPage();
    const fetchConfigs = getLayerFetchConfig(currentPage);

    const { data = [], isLoading, error } = useQuery<FeatureAttributes[], Error>({
        queryKey: queryKeys.layers.description(currentPage, fetchConfigs?.map(c => c.tableName).join(',')),
        queryFn: () => fetchLayerDescriptions(fetchConfigs),
        enabled: !!fetchConfigs && fetchConfigs.length > 0,
        staleTime: 1000 * 60 * 60 * 1,
    });

    // Combine results for easier consumption
    const combinedResult: CombinedResult = {
        data: data.reduce((acc: Record<string, string>, feature: FeatureAttributes) => {
            acc[feature.title] = feature.content;
            return acc;
        }, {}),
        isLoading,
        error,
    };

    return combinedResult;
};

export { useFetchLayerDescriptions };
