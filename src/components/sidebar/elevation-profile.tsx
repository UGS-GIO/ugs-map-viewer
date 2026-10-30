import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { elevationProfile } from '@/lib/map/dem-elevation'
import { metersToFeet } from '@/lib/map/measure-store'

// Numeric height: recharts v3 warns when ResponsiveContainer measures 0 at mount
const CHART_HEIGHT = 128
const FT_PER_MI = 5280

const fmt = (n: number) => Math.round(n).toLocaleString()

/** Ground elevation along a measured line, with its low, high, climb and descent. */
export function ElevationProfile({ path }: { path: [number, number][] }) {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: ['elevation-profile', path],
    queryFn: () => elevationProfile(queryClient, path),
    staleTime: Infinity,
  })

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
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
            formatter={(e) => [`${fmt(Number(e))} ft`, 'Elevation']}
            labelFormatter={(d) => `${inMiles ? Number(d).toFixed(2) : fmt(Number(d))} ${unit}`}
            contentStyle={{ background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', fontSize: 12 }}
          />
          <Area dataKey="elevation" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <span className="text-muted-foreground">
        Low {fmt(Math.min(...elevations))} ft · High {fmt(Math.max(...elevations))} ft · Climb {fmt(climb)} ft · Descent{' '}
        {fmt(-descent)} ft
      </span>
    </div>
  )
}
