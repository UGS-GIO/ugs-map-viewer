import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import {
  LANDSCAPE_GROUP_TITLE,
  getStacItemIdForScale,
  resolveMetricsForLayer,
  computeClassBreaks,
  getColorRampColors,
  type ClassificationMethod,
  type LandscapeMetric,
} from '../-data/landscape-metrics'
import type { PMTilesStyleOverride } from '@/components/maps/types'

export interface LandscapeFilterState {
  metric: string
  classification: ClassificationMethod
  numClasses: number
  colorRamp: string
}

export const DEFAULT_LANDSCAPE_FILTER: LandscapeFilterState = {
  metric: 'utah_percent',
  classification: 'quantile',
  numClasses: 5,
  colorRamp: 'blues',
}

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
  if (Math.abs(val) >= 1000) {
    return `${Math.round(val).toLocaleString()}${unit ? ` ${unit}` : ''}`
  }
  if (Math.abs(val) < 0.01 && val !== 0) {
    return `${val.toExponential(1)}${unit ? ` ${unit}` : ''}`
  }
  const formatted = Number(val.toFixed(2)).toString()
  return `${formatted}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
}

export function useLandscapeFilterState(): LandscapeFilterState {
  const search = useSearch({ from: '/_map' })
  const raw = search.filters?.[LANDSCAPE_GROUP_TITLE]

  return useMemo(() => {
    if (!raw) return DEFAULT_LANDSCAPE_FILTER
    try {
      const parsed = JSON.parse(raw) as Partial<LandscapeFilterState>
      return {
        metric: parsed.metric || DEFAULT_LANDSCAPE_FILTER.metric,
        classification: parsed.classification || DEFAULT_LANDSCAPE_FILTER.classification,
        numClasses: typeof parsed.numClasses === 'number' ? Math.min(10, Math.max(2, parsed.numClasses)) : DEFAULT_LANDSCAPE_FILTER.numClasses,
        colorRamp: parsed.colorRamp || DEFAULT_LANDSCAPE_FILTER.colorRamp,
      }
    } catch {
      return DEFAULT_LANDSCAPE_FILTER
    }
  }, [raw])
}

export function useLandscapeChoropleth(layerTitle?: string): LandscapeChoroplethResult {
  const filterState = useLandscapeFilterState()
  const stacItemId = layerTitle ? getStacItemIdForScale(layerTitle) : undefined

  // Ensure metric is valid for this layer (fallback if switching from HUC8 to ecoregion)
  const allowedMetrics = useMemo(() => (layerTitle ? resolveMetricsForLayer(layerTitle) : []), [layerTitle])
  const activeMetric = useMemo(() => {
    const found = allowedMetrics.find((m) => m.value === filterState.metric)
    return found || allowedMetrics[0]
  }, [allowedMetrics, filterState.metric])

  const isCategorical = activeMetric?.value === 'surface_water_trend'

  // Query DuckDB-WASM for values to compute breaks for numeric metrics (keyed on metric data only)
  const { data: queryResult, isLoading, isError } = useQuery({
    queryKey: ['landscape-raw-values', stacItemId, activeMetric?.value],
    queryFn: async () => {
      if (!stacItemId || !activeMetric || isCategorical) return null

      const { fetchStacAssetHref } = await import('@/lib/map/stac/stac-layer')
      const url = await fetchStacAssetHref(stacItemId, 'data')
      if (!url) throw new Error('Parquet asset URL missing')

      const { withConnection, escapeSql, quoteIdent } = await import('@/lib/duckdb/client')
      const col = activeMetric.value

      return withConnection(async (conn) => {
        const res = await conn.query(`
          SELECT ${quoteIdent(col)} as val
          FROM read_parquet('${escapeSql(url)}')
          WHERE ${quoteIdent(col)} IS NOT NULL
          ORDER BY ${quoteIdent(col)} ASC
        `)
        const values: number[] = []
        for (const row of res.toArray()) {
          const v = Number(row.val)
          if (!isNaN(v)) values.push(v)
        }
        return values
      })
    },
    enabled: !!stacItemId && !!activeMetric && !isCategorical,
    staleTime: Infinity,
  })

  // Build MapLibre style overrides and legend data
  return useMemo(() => {
    if (!layerTitle || !activeMetric) {
      return {
        pmtilesStyleOverrides: {},
        legendData: null,
        filterState,
        isLoading: false,
        isError: false,
      }
    }

    if (isError) {
      return {
        pmtilesStyleOverrides: {},
        legendData: null,
        filterState,
        isLoading: false,
        isError: true,
      }
    }

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
        filterState,
        isLoading: false,
        isError: false,
      }
    }

    // 2. Numeric metric with DuckDB values
    const values = queryResult ?? []
    if (values.length === 0) {
      return {
        pmtilesStyleOverrides: {},
        legendData: null,
        filterState,
        isLoading,
        isError: false,
      }
    }

    const minVal = values[0]
    const maxVal = values[values.length - 1]
    const breaks = computeClassBreaks(filterState.classification, values, filterState.numClasses)

    // Fall back to a single flat color if values cannot be partitioned
    if (breaks.length === 0) {
      const colors = getColorRampColors(filterState.colorRamp, 2)
      const fillColor = [
        'case',
        ['all', ['has', activeMetric.value], ['!=', ['get', activeMetric.value], null]],
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
        filterState,
        isLoading: false,
        isError: false,
      }
    }

    // Number of classes equals number of breaks + 1
    const actualClasses = breaks.length + 1
    const colors = getColorRampColors(filterState.colorRamp, actualClasses)

    // Build strictly ascending MapLibre step expression
    const stepArgs: unknown[] = ['step', ['to-number', ['get', activeMetric.value]], colors[0]]
    for (let i = 0; i < breaks.length; i++) {
      stepArgs.push(breaks[i], colors[i + 1] ?? colors[colors.length - 1])
    }

    const fillColor = [
      'case',
      ['all', ['has', activeMetric.value], ['!=', ['get', activeMetric.value], null]],
      stepArgs,
      'rgba(168, 168, 168, 0.15)',
    ]

    // Build Legend bins matching actualClasses exactly
    const bins: LegendBin[] = []
    for (let i = 0; i < actualClasses; i++) {
      const start = i === 0 ? minVal : breaks[i - 1]
      const end = i === actualClasses - 1 ? maxVal : breaks[i]
      const label = `${formatValue(start, activeMetric.unit)} – ${formatValue(end, activeMetric.unit)}`
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
      filterState,
      isLoading: false,
      isError: false,
    }
  }, [layerTitle, activeMetric, isCategorical, queryResult, filterState, isLoading, isError])
}
