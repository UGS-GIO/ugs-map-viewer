import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { MapImageLayerType } from '@/lib/types/mapping-types';

export interface ArcGISLegendItem {
    label: string;
    imageData: string;
    contentType: string;
    width: number;
    height: number;
}

const fetchArcGisLegend = async (mapServerUrl: string): Promise<ArcGISLegendItem[]> => {
    const response = await fetch(`${mapServerUrl}/legend?f=pjson`);
    if (!response.ok) {
        throw new Error(`Failed to fetch ArcGIS legend: ${response.statusText}`);
    }

    const json: MapImageLayerType = await response.json();
    const items: ArcGISLegendItem[] = [];

    for (const layer of json.layers ?? []) {
        for (const item of layer.legend ?? []) {
            items.push({
                label: item.label,
                imageData: item.imageData,
                contentType: item.contentType,
                width: item.width,
                height: item.height,
            });
        }
    }

    return items;
};

export function useArcGisLegend(mapServerUrl: string | undefined) {
    return useQuery({
        queryKey: queryKeys.layers.legend('arcgis', mapServerUrl),
        queryFn: () => fetchArcGisLegend(mapServerUrl!),
        enabled: !!mapServerUrl,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
