import { useCallback, useEffect, useId, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Label } from '@/components/ui/label'
import { useLayerUrl } from '@/context/layer-url-provider'
import {
  LANDSCAPE_GROUP_TITLE,
  LANDSCAPE_SCALES,
  LANDSCAPE_LAYER_TITLES,
  COLOR_RAMPS,
  CLASS_COUNTS,
  resolveMetricsForLayer,
  type ClassificationMethod,
} from '../../-data/landscape-metrics'
import {
  useLandscapeFilterState,
  DEFAULT_LANDSCAPE_FILTER,
  type LandscapeFilterState,
} from '../../-hooks/use-landscape-choropleth'
import type { LayerProps } from '@/lib/types/mapping-types'

interface LandscapeDataFiltersProps {
  layer: LayerProps
}

export function LandscapeDataFilters({ layer }: LandscapeDataFiltersProps) {
  const search = useSearch({ from: '/_map' })
  const navigate = useNavigate()
  const { setExclusiveSelection } = useLayerUrl()

  const id = useId()

  const filterState = useLandscapeFilterState()
  const activeScale = layer.title || LANDSCAPE_SCALES[0].value

  const allowedMetrics = useMemo(
    () => resolveMetricsForLayer(activeScale),
    [activeScale]
  )

  // Group metrics by category for the select element
  const groupedMetrics = useMemo(() => {
    const groups: Record<string, typeof allowedMetrics> = {}
    for (const m of allowedMetrics) {
      if (!groups[m.category]) groups[m.category] = []
      groups[m.category].push(m)
    }
    return groups
  }, [allowedMetrics])

  const activeMetricObj = useMemo(() => {
    return (
      allowedMetrics.find((m) => m.value === filterState.metric) ||
      allowedMetrics[0]
    )
  }, [allowedMetrics, filterState.metric])

  const isCategorical = activeMetricObj?.value === 'surface_water_trend'

  const updateFilter = useCallback(
    (updates: Partial<LandscapeFilterState>) => {
      const next: LandscapeFilterState = {
        ...filterState,
        metric: activeMetricObj?.value || filterState.metric,
        ...updates,
      }
      navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => {
          const prevFilters = (prev.filters as Record<string, string>) || {}
          return {
            ...prev,
            filters: {
              ...prevFilters,
              [LANDSCAPE_GROUP_TITLE]: JSON.stringify(next),
            },
          }
        },
        replace: true,
      })
    },
    [filterState, activeMetricObj, navigate]
  )

  const handleScaleChange = useCallback(
    (newScaleTitle: string) => {
      setExclusiveSelection(newScaleTitle, LANDSCAPE_LAYER_TITLES)
      const newAllowed = resolveMetricsForLayer(newScaleTitle)
      const isMetricValid = newAllowed.some(
        (m) => m.value === filterState.metric
      )
      if (!isMetricValid && newAllowed.length > 0) {
        updateFilter({ metric: newAllowed[0].value })
      }
    },
    [setExclusiveSelection, filterState.metric, updateFilter]
  )

  // Verify and reset metric in URL search params if it is invalid for the active scale
  useEffect(() => {
    if (allowedMetrics.length === 0) return
    const isMetricValid = allowedMetrics.some(
      (m) => m.value === filterState.metric
    )
    if (!isMetricValid) {
      updateFilter({ metric: allowedMetrics[0].value })
    }
  }, [allowedMetrics, filterState.metric, updateFilter])

  const handleReset = useCallback(() => {
    navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => {
        const prevFilters = {
          ...((prev.filters as Record<string, string>) || {}),
        }
        delete prevFilters[LANDSCAPE_GROUP_TITLE]
        return {
          ...prev,
          filters:
            Object.keys(prevFilters).length > 0 ? prevFilters : undefined,
        }
      },
      replace: true,
    })
  }, [navigate])

  const hasNonDefaultFilter =
    Boolean(search.filters?.[LANDSCAPE_GROUP_TITLE]) &&
    (filterState.metric !== DEFAULT_LANDSCAPE_FILTER.metric ||
      filterState.classification !== DEFAULT_LANDSCAPE_FILTER.classification ||
      filterState.numClasses !== DEFAULT_LANDSCAPE_FILTER.numClasses ||
      filterState.colorRamp !== DEFAULT_LANDSCAPE_FILTER.colorRamp)

  return (
    <div className='flex flex-col gap-3 px-1 py-1 text-xs'>
      <div className='flex items-center justify-between'>
        <span className='font-semibold text-foreground'>
          Classification Filters
        </span>
        {hasNonDefaultFilter && (
          <button
            onClick={handleReset}
            className='text-[11px] text-muted-foreground underline hover:text-foreground'
          >
            Reset
          </button>
        )}
      </div>

      {/* Select Scale */}
      <div className='flex flex-col gap-1'>
        <Label
          htmlFor={`${id}-scale`}
          className='text-[11px] font-medium text-muted-foreground'
        >
          Select Scale
        </Label>
        <select
          id={`${id}-scale`}
          value={activeScale}
          onChange={(e) => handleScaleChange(e.target.value)}
          className='h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        >
          {LANDSCAPE_SCALES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Select Metric */}
      <div className='flex flex-col gap-1'>
        <Label
          htmlFor={`${id}-metric`}
          className='text-[11px] font-medium text-muted-foreground'
        >
          Select Metric
        </Label>
        <select
          id={`${id}-metric`}
          value={activeMetricObj?.value || filterState.metric}
          onChange={(e) => updateFilter({ metric: e.target.value })}
          className='h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        >
          {Object.entries(groupedMetrics).map(([category, metrics]) => (
            <optgroup key={category} label={category}>
              {metrics.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Numeric classification options */}
      {!isCategorical && (
        <>
          <div className='grid grid-cols-2 gap-2'>
            {/* Classification Method */}
            <div className='flex flex-col gap-1'>
              <Label
                htmlFor={`${id}-class`}
                className='text-[11px] font-medium text-muted-foreground'
              >
                Classification
              </Label>
              <select
                id={`${id}-class`}
                value={filterState.classification}
                onChange={(e) =>
                  updateFilter({
                    classification: e.target.value as ClassificationMethod,
                  })
                }
                className='h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                <option value='quantile'>Quantile</option>
                <option value='equal-interval'>Equal Interval</option>
                <option value='natural-breaks'>Natural Breaks</option>
              </select>
            </div>

            {/* Breaks (Classes Count) */}
            <div className='flex flex-col gap-1'>
              <Label
                htmlFor={`${id}-breaks`}
                className='text-[11px] font-medium text-muted-foreground'
              >
                Breaks
              </Label>
              <select
                id={`${id}-breaks`}
                value={filterState.numClasses}
                onChange={(e) =>
                  updateFilter({ numClasses: Number(e.target.value) })
                }
                className='h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                {CLASS_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} Classes
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Ramp */}
          <div className='flex flex-col gap-1'>
            <Label
              htmlFor={`${id}-ramp`}
              className='text-[11px] font-medium text-muted-foreground'
            >
              Color Ramp
            </Label>
            <select
              id={`${id}-ramp`}
              value={filterState.colorRamp}
              onChange={(e) => updateFilter({ colorRamp: e.target.value })}
              className='h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            >
              {Object.entries(COLOR_RAMPS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
