import { useMutation } from '@tanstack/react-query'
import {
  queryWFSFeatures,
  queryBoxSelectFeatures,
  queryPolygonFeatures,
  type ClickQueryParams as WFSQueryParams,
  type BoxSelectQueryParams,
  type PolygonQueryParams,
  type WfsFeature as ClickedFeature,
} from '@/lib/map/wfs-service'

interface UseFeatureQueryOptions {
  onPolygonQuerySuccess?: (features: ClickedFeature[]) => void
}

/**
 * Hook that provides TanStack mutations for WFS feature queries
 * Encapsulates the click query and box select query logic
 */
export function useFeatureQuery(options: UseFeatureQueryOptions = {}) {
  const { onPolygonQuerySuccess } = options

  // TanStack mutation for WFS click queries
  // Using scope to ensure serial execution (prevents race conditions on rapid clicks)
  const clickQuery = useMutation({
    mutationFn: queryWFSFeatures,
    scope: { id: 'feature-query' },
  })

  // Box select mutation - queries features in the center box
  // Success handler is passed inline at call site for access to current isAdditiveMode
  const boxSelectQuery = useMutation({
    mutationFn: queryBoxSelectFeatures,
    scope: { id: 'box-select' },
  })

  // Polygon query mutation - queries features within a drawn polygon
  const polygonQuery = useMutation({
    mutationFn: queryPolygonFeatures,
    scope: { id: 'polygon-query' },
    onSuccess: (features) => {
      onPolygonQuerySuccess?.(features)
    },
  })

  return {
    clickQuery,
    boxSelectQuery,
    polygonQuery,
    isLoading: clickQuery.isPending || boxSelectQuery.isPending || polygonQuery.isPending,
  }
}

// Re-export types for convenience
export type { WFSQueryParams, BoxSelectQueryParams, PolygonQueryParams, ClickedFeature }
