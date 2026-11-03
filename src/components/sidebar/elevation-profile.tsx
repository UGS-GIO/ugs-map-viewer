import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { elevationProfile, groundDistanceM } from '@/lib/map/dem-elevation'
import { formatLength, formatQuantity, type UnitSystem } from '@/lib/map/measure-store'

// Numeric height: recharts v3 warns when ResponsiveContainer measures 0 at mount
const CHART_HEIGHT = 128
const FT_PER_M = 3.28084
// Same series color as the hazards-review displacement charts; clears 3:1 in both themes
const LINE_COLOR = 'hsl(var(--chart-1))'

const fmt = (n: number) => Math.round(n).toLocaleString()

/** Ground elevation along a measured line, with its low, high, climb and descent. */
export default function ElevationProfile({ path, units, onCursor }: {
  path: [number, number][]
  units: UnitSystem
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
  const [hoverIndex, setHoverIndex] = useState<number>()

  if (isPending) return <span className="text-muted-foreground">Loading elevation profile…</span>
  if (isError) return <span className="text-muted-foreground">Elevation profile unavailable</span>

  // Same switch as the line's length: ft/mi or m/km at 1,000 of the small unit
  const perM = units === 'metric' ? 1 : FT_PER_M
  const big = units === 'metric' ? 1000 : 5280
  const inBig = data[data.length - 1].distanceM * perM >= 1000
  const points = data.map((p) => ({
    distance: (p.distanceM * perM) / (inBig ? big : 1),
    elevation: p.elevationM * perM,
  }))
  const elevUnit = units === 'metric' ? 'm' : 'ft'
  const elevations = points.map((p) => p.elevation)
  const steps = elevations.slice(1).map((e, i) => e - elevations[i])
  const climb = steps.reduce((sum, d) => sum + Math.max(d, 0), 0)
  const descent = steps.reduce((sum, d) => sum + Math.min(d, 0), 0)
  const unit = units === 'metric' ? (inBig ? 'km' : 'm') : inBig ? 'mi' : 'ft'
  const ground = formatQuantity(formatLength(groundDistanceM(data), units))
  const activeIndex = pinnedIndex ?? hoverIndex
  const active = activeIndex === undefined ? undefined : points[activeIndex]

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
            if (pinnedIndex !== undefined || activeTooltipIndex == null) return
            setHoverIndex(Number(activeTooltipIndex))
            onCursor?.(data[Number(activeTooltipIndex)]?.at)
          }}
          // A pinned point keeps its marker and readout
          onMouseLeave={() => {
            setHoverIndex(undefined)
            onCursor?.(pinnedIndex === undefined ? undefined : data[pinnedIndex]?.at)
          }}
        >
          <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={[0, 'dataMax']}
            stroke="currentColor"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            tickFormatter={(d: number) => `${inBig ? d.toFixed(1) : fmt(d)} ${unit}`}
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
            // The readout below says the values; a floating box would cover the line being read
            content={() => null}
          />
          <Area dataKey="elevation" stroke={LINE_COLOR} strokeWidth={2} fill={LINE_COLOR} fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <span aria-live="polite" className={active ? undefined : 'text-muted-foreground'}>
        {active
          ? `${inBig ? active.distance.toFixed(2) : fmt(active.distance)} ${unit} along: ${fmt(active.elevation)} ${elevUnit}${pinnedIndex !== undefined ? ' (pinned; click again to release)' : ''}`
          : 'Hover or tap the chart to read a point; click to pin it.'}
      </span>
      {/* What a measuring wheel would read along the line, up and down the terrain */}
      <span>Along the ground: {ground}</span>
      <span className="text-muted-foreground">
        Low {fmt(Math.min(...elevations))} {elevUnit} · High {fmt(Math.max(...elevations))} {elevUnit} · Climb {fmt(climb)} {elevUnit} ·
        Descent {fmt(-descent)} {elevUnit}
      </span>
    </div>
  )
}
