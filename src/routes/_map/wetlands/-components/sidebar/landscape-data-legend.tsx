import type { LayerProps } from '@/lib/types/mapping-types'
import { useLandscapeChoropleth } from '../../-hooks/use-landscape-choropleth'
import { Spinner } from '@/components/ui/loading-spinner'

interface LandscapeDataLegendProps {
  layer: LayerProps
}

export function LandscapeDataLegend({ layer }: LandscapeDataLegendProps) {
  const { legendData, isLoading, isError, filterState } = useLandscapeChoropleth(layer.title)

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
        <Spinner />
        <span>Calculating class breaks...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className='py-1 text-xs text-destructive'>
        Failed to calculate class breaks for {layer.title}
      </div>
    )
  }

  if (!legendData || legendData.bins.length === 0) {
    return null
  }

  const isCategorical = legendData.metric.value === 'surface_water_trend'

  return (
    <div className='flex flex-col gap-1.5 py-1 text-xs'>
      <div className='flex items-center justify-between font-medium text-foreground'>
        <span className='truncate'>{legendData.metric.label}</span>
      </div>
      {!isCategorical && (
        <span className='text-[10px] text-muted-foreground capitalize'>
          {filterState.classification.replace('-', ' ')} • {legendData.bins.length} classes
        </span>
      )}
      <div className='flex flex-col gap-1 pt-1'>
        {legendData.bins.map((bin, i) => (
          <div key={i} className='flex items-center gap-2'>
            <span
              className='h-3.5 w-5 shrink-0 rounded-sm border border-border shadow-xs'
              style={{ backgroundColor: bin.color }}
            />
            <span className='text-[11px] text-muted-foreground'>{bin.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
