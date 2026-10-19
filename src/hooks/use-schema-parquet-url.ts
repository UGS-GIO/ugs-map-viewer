/** Schema's geoparquet URL from its STAC item; undefined keeps the schema on PostgREST. */
import { useQuery } from '@tanstack/react-query';
import { fetchStacAssetHref } from '@/lib/map/stac/stac-layer';
import type { FilterSchema } from '@/lib/filter/types';

export const useSchemaParquetUrl = (schema: FilterSchema, assetKey: string = 'data') => {
    const stacItemId = schema.stacItemId;
    const { data } = useQuery({
        queryKey: ['schema-parquet-url', stacItemId, assetKey],
        queryFn: async () => {
            if (!stacItemId) return null;
            const href = await fetchStacAssetHref(stacItemId, assetKey);
            return href ?? null;
        },
        enabled: !!stacItemId,
        staleTime: 1000 * 60 * 30,
    });
    return { parquetUrl: data ?? undefined, isResolving: !!stacItemId && data === undefined };
};
