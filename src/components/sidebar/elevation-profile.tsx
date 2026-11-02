import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { elevationProfile } from '@/lib/map/dem-elevation'
import { metersToFeet } from '@/lib/map/measure-store'

// Numeric height: recharts v3 warns when ResponsiveContainer measures 0 at mount
const CHART_HEIGHT = 128
const FT_PER_MI = 5280
// Same series color as the hazards-review displacement charts; clears 3:1 in both themes
const LINE_COLOR = 'hsl(var(--chart-1))'

const fmt = (n: number) => Math.round(n).toLocaleString()

/** Ground elevation along a measured line, with its low, high, climb and descent. */
export default function ElevationProfile({ path, onCursor }: {
  path: [number, number][]
  /** Where on the line the chart's active point is, for a marker on the map */
  onCursor?: (at: [number, number] | undefined) => void
}) {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: ['elevation-profile', path],
    queryFn: () => elevationProfile(queryClient, path),
    staleTime: Infinity,
  })
  // Click pins the tooltip at a point so it stays readable without holding the pointer there
  const [pinnedIndex, setPinnedIndex] = useState<number>()

  if (isPending) return <span className="text-muted-foreground">Loading elevation profile…</span>
  if (isError) return <span className="text-muted-foreground">Elevation profile unavailable</span>

  const totalFt = metersToFeet(data[data.length - 1].distanceM)
  const inMiles = totalFt >= 1000
  const points = data.map((p) => {
    const ft = metersToFeet(p.distanceM)
    return { distance: inMiles ? ft / FT_PER_MI : ft, elevation: metersToFeet(p.elevationM) }
  })
  const elevations = points.map((p) => p.elevation)
  const steps = elevations.slice(1).map((e, i) => e - elevations[i])
  const climb = steps.reduce((sum, d) => sum + Math.max(d, 0), 0)
  const descent = steps.reduce((sum, d) => sum + Math.min(d, 0), 0)
  const unit = inMiles ? 'mi' : 'ft'

  return (
    <div className="grid gap-1">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart
          data={points}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onClick={({ activeTooltipIndex }) => {
            const i = activeTooltipIndex == null ? undefined : Number(activeTooltipIndex)
            const next = i === pinnedIndex ? undefined : i
            setPinnedIndex(next)
            onCursor?.(next === undefined ? undefined : data[next]?.at)
          }}
          onMouseMove={({ activeTooltipIndex }) => {
            if (pinnedIndex === undefined && activeTooltipIndex != null) onCursor?.(data[Number(activeTooltipIndex)]?.at)
          }}
          // A pinned point keeps its marker
          onMouseLeave={() => onCursor?.(pinnedIndex === undefined ? undefined : data[pinnedIndex]?.at)}
        >
          <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={[0, 'dataMax']}
            stroke="currentColor"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            tickFormatter={(d: number) => `${inMiles ? d.toFixed(1) : fmt(d)} ${unit}`}
          />
          <YAxis
            dataKey="elevation"
            domain={['auto', 'auto']}
            stroke="currentColor"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            tickFormatter={fmt}
            width={44}
          />
          <Tooltip
            // Recharts keeps the clicked point active in click mode
            trigger={pinnedIndex === undefined ? 'hover' : 'click'}
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
            separator=": "
            formatter={(e) => [`${fmt(Number(e))} ft`, 'Elevation']}
            labelFormatter={(d) => `${inMiles ? Number(d).toFixed(2) : fmt(Number(d))} ${unit}`}
            contentStyle={{ background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', fontSize: 12 }}
            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
          />
          <Area dataKey="elevation" stroke={LINE_COLOR} strokeWidth={2} fill={LINE_COLOR} fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <span className="text-muted-foreground">
        Low {fmt(Math.min(...elevations))} ft · High {fmt(Math.max(...elevations))} ft · Climb {fmt(climb)} ft · Descent{' '}
        {fmt(-descent)} ft
      </span>
    </div>
  )
}
