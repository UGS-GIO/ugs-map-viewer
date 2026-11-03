import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { elevationProfile, groundDistanceM } from '@/lib/map/dem-elevation'
import { elevationUnit, formatLength, formatQuantity, lengthUnit, type UnitSystem } from '@/lib/map/measure-store'

// Numeric height: recharts v3 warns when ResponsiveContainer measures 0 at mount
const CHART_HEIGHT = 128
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

  // Memoized so hovering (which re-renders for the readout) hands recharts the same data
  const chart = useMemo(() => {
    if (!data) return undefined
    // Same unit switch as the line's length label
    const len = lengthUnit(data[data.length - 1].distanceM, units)
    const elev = elevationUnit(units)
    const points = data.map((p) => ({ distance: p.distanceM / len.m, elevation: p.elevationM / elev.m }))
    const elevations = points.map((p) => p.elevation)
    const steps = elevations.slice(1).map((e, i) => e - elevations[i])
    return {
      len,
      elevUnit: elev.unit,
      points,
      low: Math.min(...elevations),
      high: Math.max(...elevations),
      climb: steps.reduce((sum, d) => sum + Math.max(d, 0), 0),
      descent: steps.reduce((sum, d) => sum - Math.min(d, 0), 0),
      ground: formatQuantity(formatLength(groundDistanceM(data), units)),
    }
  }, [data, units])

  if (isPending) return <span className="text-muted-foreground">Loading elevation profile…</span>
  if (isError || !chart) return <span className="text-muted-foreground">Elevation profile unavailable</span>

  const { len, elevUnit, points, low, high, climb, descent, ground } = chart
  const unit = len.unit
  const fmtDistance = (d: number) => (len.small ? fmt(d) : d.toFixed(2))
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
            const i = activeTooltipIndex == null ? undefined : Number(activeTooltipIndex)
            // Skip while pinned or still on the same sample: no re-render, no map setData
            if (pinnedIndex !== undefined || i === undefined || i === hoverIndex) return
            setHoverIndex(i)
            onCursor?.(data[i]?.at)
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
            tickFormatter={(d: number) => `${len.small ? fmt(d) : d.toFixed(1)} ${unit}`}
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
          ? `${fmtDistance(active.distance)} ${unit} along: ${fmt(active.elevation)} ${elevUnit}${pinnedIndex !== undefined ? ' (pinned; click again to release)' : ''}`
          : 'Hover or tap the chart to read a point; click to pin it.'}
      </span>
      {/* What a measuring wheel would read along the line, up and down the terrain */}
      <span>Along the ground: {ground}</span>
      <span className="text-muted-foreground">
        Low {fmt(low)} {elevUnit} · High {fmt(high)} {elevUnit} · Climb {fmt(climb)} {elevUnit} ·
        Descent {fmt(descent)} {elevUnit}
      </span>
    </div>
  )
}
