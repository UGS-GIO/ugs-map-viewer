import { LayerFetchConfig, getLayerFetchConfig } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { useGetCurrentPage } from "@/hooks/use-get-current-page";

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
            const url = `https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app/${tableName}?select=${outfields}`;

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

            return await response.json();
        })
    );

    // Flatten all results into a single array
    return allResults.flat();
};

const useFetchLayerDescriptions = (): CombinedResult => {
    const currentPage = useGetCurrentPage();
    const fetchConfigs = getLayerFetchConfig(currentPage);

    const { data = [], isLoading, error } = useQuery<FeatureAttributes[], Error>({
        queryKey: ['layerDescriptions', currentPage, fetchConfigs?.map(c => c.tableName).join(',')],
        queryFn: () => fetchLayerDescriptions(fetchConfigs),
        enabled: !!fetchConfigs && fetchConfigs.length > 0,
        staleTime: 1000 * 60 * 60 * 1,
    });


    type FeatureAttributes = {
        title: string;
        content: string;
    };

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
