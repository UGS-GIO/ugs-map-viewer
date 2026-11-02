import { useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import {
  LANDSCAPE_GROUP_TITLE,
  LANDSCAPE_SCALES,
  CLASSIFICATION_METHODS,
  MIN_CLASSES,
  MAX_CLASSES,
  getStacItemIdForScale,
  resolveMetricsForLayer,
  computeClassBreaks,
  getColorRampColors,
  type LandscapeMetric,
} from '../-data/landscape-metrics'
import type { PMTilesStyleOverride } from '@/components/maps/types'

export const landscapeFilterSchema = z.object({
  metric: z.string().catch('utah_percent'),
  classification: z.enum(CLASSIFICATION_METHODS).catch('quantile'),
  numClasses: z.coerce
    .number()
    .int()
    .min(MIN_CLASSES)
    .max(MAX_CLASSES)
    .catch(5),
  colorRamp: z.string().catch('blues'),
})

export type LandscapeFilterState = z.infer<typeof landscapeFilterSchema>

export const DEFAULT_LANDSCAPE_FILTER: LandscapeFilterState =
  landscapeFilterSchema.parse({})

const EMPTY_OVERRIDES: Record<string, PMTilesStyleOverride> = {}

export interface LegendBin {
  label: string
  color: string
  min?: number
  max?: number
}

export interface LandscapeChoroplethResult {
  pmtilesStyleOverrides: Record<string, PMTilesStyleOverride>
  legendData: {
    metric: LandscapeMetric
    bins: LegendBin[]
  } | null
  filterState: LandscapeFilterState
  isLoading: boolean
  isError: boolean
}

function formatValue(val: number, unit?: string): string {
  const unitSuffix = unit ? (unit === '%' ? '%' : ` ${unit}`) : ''
  if (Math.abs(val) >= 1000) {
    return `${Math.round(val).toLocaleString()}${unitSuffix}`
  }
  if (Math.abs(val) < 0.01 && val !== 0) {
    return `${val.toExponential(1)}${unitSuffix}`
  }
  return `${Number(val.toFixed(2))}${unitSuffix}`
}

export function buildChoroplethStepExpression(
  metricCol: string,
  minVal: number,
  breaks: number[],
  colors: string[]
): unknown[] {
  const safeFallback = Number.isFinite(minVal) ? minVal : 0
  const stepArgs: unknown[] = [
    'step',
    ['to-number', ['get', metricCol], safeFallback],
    colors[0],
  ]
  for (let i = 0; i < breaks.length; i++) {
    stepArgs.push(breaks[i], colors[i + 1] ?? colors[colors.length - 1])
  }

  return [
    'case',
    ['all', ['has', metricCol], ['!=', ['get', metricCol], null]],
    stepArgs,
    'rgba(168, 168, 168, 0.15)',
  ]
}

export function getLandscapeParquetUrl(stacItemId: string): string {
  return `https://maps-assets.geology.utah.gov/warehouse/geoparquet/${stacItemId}/${stacItemId}.parquet`
}

export async function fetchLandscapeMetricValues(
  stacItemId: string,
  metric: string
): Promise<number[]> {
  const url = getLandscapeParquetUrl(stacItemId)
  const { withConnection, escapeSql, quoteIdent } =
    await import('@/lib/duckdb/client')

  return withConnection(async (conn) => {
    const res = await conn.query(`
      SELECT ${quoteIdent(metric)} as val
      FROM read_parquet('${escapeSql(url)}')
      WHERE ${quoteIdent(metric)} IS NOT NULL
    `)
    const values: number[] = []
    for (const row of res.toArray()) {
      const v = Number(row.val)
      if (!isNaN(v)) values.push(v)
    }
    values.sort((a, b) => a - b)
    return values
  })
}

/**
 * Preload the active metric across all 5 spatial scales in the background.
 * Ensures that clicking between HUC12, HUC8, Ecoregion, etc. resolves instantly from cache.
 */
export function usePreloadLandscapeData() {
  const queryClient = useQueryClient()
  const filterState = useLandscapeFilterState()

  useEffect(() => {
    const metric = filterState.metric
    if (!metric || metric === 'surface_water_trend') return

    for (const scale of LANDSCAPE_SCALES) {
      const allowed = resolveMetricsForLayer(scale.value)
      if (!allowed.some((m) => m.value === metric)) continue

      queryClient.prefetchQuery({
        queryKey: ['landscape-raw-values', scale.stacItemId, metric],
        queryFn: () => fetchLandscapeMetricValues(scale.stacItemId, metric),
        staleTime: Infinity,
      })
    }
  }, [filterState.metric, queryClient])
}

export function useLandscapeFilterState(): LandscapeFilterState {
  const search = useSearch({ from: '/_map' })
  const raw = search.filters?.[LANDSCAPE_GROUP_TITLE]

  return useMemo(() => {
    if (!raw) return DEFAULT_LANDSCAPE_FILTER
    try {
      const parsed = JSON.parse(raw)
      const validated = landscapeFilterSchema.safeParse(parsed)
      return validated.success ? validated.data : DEFAULT_LANDSCAPE_FILTER
    } catch {
      return DEFAULT_LANDSCAPE_FILTER
    }
  }, [raw])
}

export function useLandscapeChoropleth(
  layerTitle?: string
): LandscapeChoroplethResult {
  const filterState = useLandscapeFilterState()
  const stacItemId = layerTitle ? getStacItemIdForScale(layerTitle) : undefined

  // Ensure metric is valid for this layer (fallback if switching from HUC8 to ecoregion)
  const allowedMetrics = useMemo(
    () => (layerTitle ? resolveMetricsForLayer(layerTitle) : []),
    [layerTitle]
  )
  const activeMetric = useMemo(() => {
    const found = allowedMetrics.find((m) => m.value === filterState.metric)
    return found || allowedMetrics[0]
  }, [allowedMetrics, filterState.metric])

  const isCategorical = activeMetric?.value === 'surface_water_trend'

  // Query DuckDB-WASM for values to compute breaks for numeric metrics (keyed on metric data only)
  const {
    data: queryResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['landscape-raw-values', stacItemId, activeMetric?.value],
    queryFn: async () => {
      if (!stacItemId || !activeMetric || isCategorical) return null
      return fetchLandscapeMetricValues(stacItemId, activeMetric.value)
    },
    enabled: !!stacItemId && !!activeMetric && !isCategorical,
    staleTime: Infinity,
  })

  // Build MapLibre style overrides and legend data
  return useMemo(() => {
    const effectiveFilterState = activeMetric
      ? { ...filterState, metric: activeMetric.value }
      : filterState

    const empty = (
      loading = false,
      error = false
    ): LandscapeChoroplethResult => ({
      pmtilesStyleOverrides: EMPTY_OVERRIDES,
      legendData: null,
      filterState: effectiveFilterState,
      isLoading: loading,
      isError: error,
    })

    if (!layerTitle || !activeMetric) return empty()
    if (isError) return empty(false, true)

    // 1. Categorical: surface_water_trend
    if (isCategorical) {
      const fillColor = [
        'match',
        ['to-string', ['coalesce', ['get', 'surface_water_trend'], '0']],
        '3',
        '#4A50FF', // Increasing
        '2',
        '#FF564A', // Decreasing
        '1',
        '#F5F5DC', // No Trend
        '0',
        'rgba(168, 168, 168, 0.15)', // No Data
        'rgba(168, 168, 168, 0.15)',
      ]

      const bins: LegendBin[] = [
        { label: 'Increasing', color: '#4A50FF' },
        { label: 'Decreasing', color: '#FF564A' },
        { label: 'No Trend', color: '#F5F5DC' },
        { label: 'No Data', color: 'rgba(168, 168, 168, 0.25)' },
      ]

      return {
        pmtilesStyleOverrides: {
          [layerTitle]: { fillColor },
        },
        legendData: {
          metric: activeMetric,
          bins,
        },
        filterState: effectiveFilterState,
        isLoading: false,
        isError: false,
      }
    }

    // 2. Numeric metric with DuckDB values
    const values = queryResult ?? []
    if (values.length === 0) return empty(isLoading)

    const minVal = values[0]
    const maxVal = values[values.length - 1]
    const breaks = computeClassBreaks(
      filterState.classification,
      values,
      filterState.numClasses
    )

    // Fall back to a single flat color if values cannot be partitioned
    if (breaks.length === 0) {
      const colors = getColorRampColors(filterState.colorRamp, 2)
      const fillColor = [
        'case',
        [
          'all',
          ['has', activeMetric.value],
          ['!=', ['get', activeMetric.value], null],
        ],
        colors[0],
        'rgba(168, 168, 168, 0.15)',
      ]
      return {
        pmtilesStyleOverrides: {
          [layerTitle]: { fillColor },
        },
        legendData: {
          metric: activeMetric,
          bins: [
            {
              label: formatValue(minVal, activeMetric.unit),
              color: colors[0],
              min: minVal,
              max: maxVal,
            },
          ],
        },
        filterState: effectiveFilterState,
        isLoading: false,
        isError: false,
      }
    }

    // Number of classes equals number of breaks + 1
    const actualClasses = breaks.length + 1
    const colors = getColorRampColors(filterState.colorRamp, actualClasses)

    const fillColor = buildChoroplethStepExpression(
      activeMetric.value,
      minVal,
      breaks,
      colors
    )

    // First value strictly greater than minVal to check if bin 0 is exclusively minimums (e.g. zeros)
    const firstNonMin = values.find((v) => v > minVal)

    // Build Legend bins matching actualClasses exactly
    const bins: LegendBin[] = []
    for (let i = 0; i < actualClasses; i++) {
      const start = i === 0 ? minVal : breaks[i - 1]
      const rawEnd = i === actualClasses - 1 ? maxVal : breaks[i]
      let end = rawEnd

      // When the upper bound of an interior bin is maxVal (e.g. 100% saturation spike),
      // show the actual upper value in this bin so it doesn't display identical ranges
      if (rawEnd === maxVal && i < actualClasses - 1) {
        end = Math.max(start, values[values.indexOf(rawEnd) - 1])
      }

      let label: string
      if (start === end) {
        label = formatValue(start, activeMetric.unit)
      } else if (i === 0 && breaks[0] === firstNonMin) {
        label = formatValue(start, activeMetric.unit)
      } else {
        label = `${formatValue(start, activeMetric.unit)} – ${formatValue(end, activeMetric.unit)}`
      }

      bins.push({
        label,
        color: colors[i],
        min: start,
        max: end,
      })
    }

    return {
      pmtilesStyleOverrides: {
        [layerTitle]: { fillColor },
      },
      legendData: {
        metric: activeMetric,
        bins,
      },
      filterState: effectiveFilterState,
      isLoading: false,
      isError: false,
    }
  }, [
    layerTitle,
    activeMetric,
    isCategorical,
    queryResult,
    filterState,
    isLoading,
    isError,
  ])
}
