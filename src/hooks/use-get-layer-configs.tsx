import { useMemo } from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { LayerProps } from "@/lib/types/mapping-types";
import { useGetCurrentPage } from "./use-get-current-page";

export interface LayerOrderConfig {
    layerName: string;
    position: 'start' | 'end' | number;
}

// Function to find a layer by name in a nested structure
export const findLayerByName = (layers: LayerProps[], name: string): { layer: LayerProps; parent: LayerProps[] | null } | null => {
    for (const layer of layers) {
        if (layer.title === name) {
            return { layer, parent: layers };
        }

        // Check in group layers
        if ('layers' in layer && Array.isArray(layer.layers)) {
            const result = findLayerByName(layer.layers, name);
            if (result) return result;
        }
    }
    return null;
};

// Function to apply layer reordering based on configurations
const applyLayerOrdering = (layers: LayerProps[], orderConfigs: LayerOrderConfig[]): LayerProps[] => {
    if (!orderConfigs || orderConfigs.length === 0) return layers;

    const processedConfig = [...layers];
    const layersToReorder = new Map<string, { layer: LayerProps; parent: LayerProps[] | null }>();

    // First, find and remove all layers that need to be reordered
    orderConfigs.forEach(config => {
        const result = findLayerByName(processedConfig, config.layerName);
        if (result) {
            layersToReorder.set(config.layerName, result);
            if (result.parent) {
                const index = result.parent.indexOf(result.layer);
                if (index !== -1) {
                    result.parent.splice(index, 1);
                }
            }
        }
    });

    // Then, insert layers at their specified positions in the root config
    orderConfigs.forEach(orderConfig => {
        const layerInfo = layersToReorder.get(orderConfig.layerName);
        if (layerInfo) {
            if (orderConfig.position === 'start') {
                processedConfig.unshift(layerInfo.layer);
            } else if (orderConfig.position === 'end') {
                processedConfig.push(layerInfo.layer);
            } else if (typeof orderConfig.position === 'number') {
                const insertIndex = Math.min(
                    Math.max(0, orderConfig.position),
                    processedConfig.length
                );
                processedConfig.splice(insertIndex, 0, layerInfo.layer);
            }
        }
    });

    return processedConfig;
};

// Query functions
const loadSingleLayerConfig = async (currentPage: string, pageName: string): Promise<LayerProps[]> => {
    if (!currentPage) {
        throw new Error('No current page available');
    }

    try {
        const config = await import(`@/routes/_map/${currentPage}/-data/layers/${pageName}.tsx`) as { default: LayerProps[] };
        if (config.default && Array.isArray(config.default)) {
            return config.default;
        } else {
            throw new Error('Invalid config format');
        }
    } catch (error) {
        console.error(`Error loading layer configuration ${pageName}:`, error);
        throw error;
    }
};

const loadAllLayerConfigs = async (currentPage: string): Promise<LayerProps[]> => {
    try {
        const layerConfigPaths = import.meta.glob(`@/routes/_map/*/-data/layers/*.tsx`);

        // filter for layerconfig paths in the /routes/_map/{currentPage}/-data/layers/ directory
        const filteredLayerConfigPaths: Record<string, () => Promise<any>> = {};
        for (const path of Object.keys(layerConfigPaths)) {
            if (path.includes(`/_map/${currentPage}/-data/layers/`)) {
                filteredLayerConfigPaths[path] = layerConfigPaths[path];
            }
        }

        const allConfigs: LayerProps[] = [];

        // Load all layer config files
        for (const path of Object.keys(filteredLayerConfigPaths)) {
            try {
                const config = await filteredLayerConfigPaths[path]() as { default: LayerProps[] };
                if (config.default && Array.isArray(config.default)) {
                    allConfigs.push(...config.default);
                }
            } catch (error) {
                console.warn(`Failed to load layer config from ${path}:`, error);
            }
        }

        return allConfigs;
    } catch (error) {
        console.error('Error loading layer configurations:', error);
        throw error;
    }
};

// Main hook that returns the full query object
const useGetLayerConfigs = (pageName?: string, layerOrderConfigs?: LayerOrderConfig[]) => {
    const currentPage = useGetCurrentPage();

    // Memoize the layerOrderConfigs to prevent unnecessary re-renders
    const memoizedLayerOrderConfigs = useMemo(() => layerOrderConfigs, [JSON.stringify(layerOrderConfigs)]);

    // Create a stable query key that includes namespace (currentPage)
    const queryKey = useMemo(() => {
        if (pageName) {
            return ['layerConfigs', 'single', 'namespace', currentPage, 'pageName', pageName, 'orderConfigs', memoizedLayerOrderConfigs];
        } else {
            return ['layerConfigs', 'all', 'namespace', currentPage, 'orderConfigs', memoizedLayerOrderConfigs];
        }
    }, [pageName, currentPage, memoizedLayerOrderConfigs]);

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<LayerProps[] | null> => {
            if (pageName) {
                // Single config workflow
                if (!currentPage) {
                    return null;
                }
                const configs = await loadSingleLayerConfig(currentPage, pageName);
                return applyLayerOrdering(configs, memoizedLayerOrderConfigs || []);
            } else {
                // All configs workflow
                const allConfigs = await loadAllLayerConfigs(currentPage);
                const processedConfigs = applyLayerOrdering(allConfigs, memoizedLayerOrderConfigs || []);
                return processedConfigs.length > 0 ? processedConfigs : null;
            }
        },
        enabled: !pageName || !!currentPage, // Only run query if we have currentPage (for single config) or we're loading all configs
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v3)
        retry: 2,
    }) as UseQueryResult<LayerProps[] | null, Error>;

    return {
        layerConfigs: query.data || null,
        isLoading: query.isLoading,
        error: query.error,
        isError: query.isError,
        refetch: query.refetch,
        isFetching: query.isFetching,
        // Don't spread the entire query to avoid duplicate keys
        isSuccess: query.isSuccess,
        status: query.status
    };
};

// Convenience hook that returns just the data (for backward compatibility)
const useGetLayerConfigsData = (pageName?: string, layerOrderConfigs?: LayerOrderConfig[]): LayerProps[] | null => {
    const { layerConfigs } = useGetLayerConfigs(pageName, layerOrderConfigs);
    return layerConfigs || null;
};

export { useGetLayerConfigs, useGetLayerConfigsData };