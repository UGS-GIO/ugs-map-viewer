import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchReviewDisplacementParquetUrl, fetchReviewDisplacementStyleUrls } from '@/lib/map/stac/review-catalog-group';
import { getStyleNameForType, type DisplacementType } from '@/routes/_map/hazards-review/-components/popups/displacement-layers';

/** The review displacement geoparquet URL (for the displacement panel's duckdb-wasm stats/filters). */
export function useReviewDisplacementParquetUrl(): string | undefined {
  const { data } = useQuery({
    queryKey: ['review-displacement-parquet'],
    queryFn: fetchReviewDisplacementParquetUrl,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return data ?? undefined;
}

// Which catalog render carries each type's symbology. Mirrors the displacement filter field's
// optionRenders — the bins lookup is keyed by GeoServer style name (what the chart hooks ask for), so we
// translate renderId -> styleName here.
const RENDER_ID_BY_TYPE: Record<DisplacementType, string> = {
  'Cumulative': 'cumulative',
  'Yearly': 'yearly',
  'Vertical Displacement Rate': 'velocity',
};

/** {styleName -> GL style URL} so the chart's bins parse from the review GL styles, never GeoServer. */
export function useReviewDisplacementGlStyleUrls(): Record<string, string> {
  const { data } = useQuery({
    queryKey: ['review-displacement-style-urls'],
    queryFn: fetchReviewDisplacementStyleUrls,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return useMemo(() => {
    const byRenderId = data ?? {};
    const out: Record<string, string> = {};
    for (const [type, renderId] of Object.entries(RENDER_ID_BY_TYPE) as [DisplacementType, string][]) {
      const styleName = getStyleNameForType(type);
      const url = byRenderId[renderId];
      if (styleName && url) out[styleName] = url;
    }
    return out;
  }, [data]);
}
