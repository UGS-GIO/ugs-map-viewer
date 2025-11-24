import { useQuery } from '@tanstack/react-query';
import { PROD_POSTGREST_URL } from "@/lib/constants";
import { LayerProps } from '@/lib/types/mapping-types';
import type { PostgRESTRowOf } from '@/lib/types/postgrest-types';
import { isGroupLayer, isWMSLayer } from '@/lib/map/utils';
import { useGetLayerConfigsData } from './use-get-layer-configs';
import { queryKeys } from '@/lib/query-keys';

type ReviewableLayerInfo = PostgRESTRowOf<{
    schema_name: string;
    matview_name: string;
    has_r_values: boolean;
}>

export interface LayerOption {
    value: string; // The raw name, e.g., 'hazards:quaternaryfaults_current'
    label: string; // The friendly title, e.g., 'Hazardous (Quaternary age) Faults - Statewide'
}

const fetchReviewableLayers = async (): Promise<ReviewableLayerInfo[]> => {
    const functionUrl = `${PROD_POSTGREST_URL}/rpc/find_r_values_in_review_matviews`;

    const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Accept-Profile': 'mapping',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch reviewable layers: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json() as ReviewableLayerInfo[];
};

export const useFetchReviewableLayers = () => {
    const layerConfig = useGetLayerConfigsData('review-layers');

    return useQuery<ReviewableLayerInfo[], Error, LayerOption[]>({
        queryKey: queryKeys.layers.reviewable(layerConfig),
        queryFn: fetchReviewableLayers,
        enabled: !!layerConfig,
        select: (data) => {
            if (!layerConfig) return [];

            const titleMap = new Map<string, string>();

            const recursivelyFindTitles = (layers: LayerProps[]) => {
                for (const layer of layers) {
                    // If it's a WMS layer, process its sublayers to build the map
                    if (isWMSLayer(layer) && layer.sublayers) {
                        for (const sublayer of layer.sublayers) {
                            if (sublayer.name && layer.title) {
                                const sublayerWithSchema = sublayer;
                                if (!sublayer.name.includes(':') && sublayerWithSchema.schema) {
                                    titleMap.set(`${sublayerWithSchema.schema}:${sublayer.name}`, layer.title);
                                } else {
                                    titleMap.set(sublayer.name, layer.title);
                                }
                            }
                        }
                    }
                    // Else if it's a Group layer, recurse into its nested layers
                    else if (isGroupLayer(layer) && layer.layers) {
                        recursivelyFindTitles(layer.layers);
                    }
                }
            };
            recursivelyFindTitles(layerConfig);

            const finalOptions = data
                .filter(layer => layer.has_r_values === true)
                .flatMap(layer => {
                    const rawNameWithSchema = `${layer.schema_name}:${layer.matview_name}`;
                    const label = titleMap.get(rawNameWithSchema);
                    if (label) {
                        return [{ value: rawNameWithSchema, label: label }];
                    }
                    return [];
                })
                .sort((a, b) => a.label.localeCompare(b.label));

            return finalOptions;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });
};