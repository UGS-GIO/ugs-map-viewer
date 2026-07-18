import { useQuery } from '@tanstack/react-query';
import { fetchReviewCatalog } from '@/lib/map/stac/review-catalog-group';

export interface LayerOption {
  value: string; // STAC item id — also the comment thread key (see layerToItemId)
  label: string; // item title
}

/**
 * Reviewable layers for the comments picker — the actual review STAC catalog items (same source as the
 * auto-discovered "Review" map group), NOT a static-config name match. `value` is the STAC item id, which
 * is also the comment item id, so a comment lands on the same thread as the internal review viewer.
 */
export const useFetchReviewableLayers = (): { data: LayerOption[] } => {
  const { data } = useQuery({
    queryKey: ['review-catalog-layers'],
    queryFn: async (): Promise<LayerOption[]> => {
      const items = await fetchReviewCatalog();
      return items
        .map((i) => ({ value: i.id, label: (i.properties?.title as string | undefined) ?? i.id }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
  return { data: data ?? [] };
};
