import { useQuery } from '@tanstack/react-query';
import { fetchReviewDisplacementParquetUrl } from '@/lib/map/stac/review-catalog-group';

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
