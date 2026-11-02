import { lazy, memo, Suspense } from 'react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMeasureMode, useMeasurements } from '@/hooks/use-measure'
import { useMap } from '@/hooks/use-map'
import { useCoordinateFormat } from '@/hooks/use-map-coordinates'
import { formatCoordinatePair } from '@/lib/map/conversion-utils'
import { MEASURE_MODES, isMeasureMode, type Measurement } from '@/lib/map/measure-store'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'

// Recharts is heavy; load it only once a line is finished
const ElevationProfile = lazy(() => import('./elevation-profile'))

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

// Memoized: measurements keep their object while unchanged, so drawing doesn't re-render finished rows
const MeasurementRow = memo(function MeasurementRow({ m, index, highlighted, onHighlight, onProfileCursor }: {
  m: Measurement
  index: number
  highlighted: boolean
  onHighlight?: (id: string | number | undefined) => void
  onProfileCursor?: (at: [number, number] | undefined) => void
}) {
  const { coordinateFormat } = useCoordinateFormat()
  const { label, icon: Icon } = MEASURE_TOOLS[m.mode]
  const coords = m.coordinates && formatCoordinatePair(m.coordinates[0], m.coordinates[1], coordinateFormat, 5)
  return (
    // Hovering a row halos its shape on the map, and hovering the shape highlights the row
    <li
      data-measure-id={m.id}
      onPointerEnter={() => onHighlight?.(m.id)}
      onPointerLeave={() => onHighlight?.(undefined)}
      className={cn('flex gap-3 rounded-sm bg-popover p-2 text-sm ring-primary md:p-3', highlighted && 'ring-2')}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-bold">{label} {index + 1}</span>
        {m.value !== undefined && <span>{fmt(m.value)} {m.unit}</span>}
        {coords?.map((c) => <span key={c.label}>{c.label}: {c.value}</span>)}
        {m.mode === 'point' && <span>Elevation: {m.elevationFt === undefined ? '…' : m.elevationFt === null ? 'Unavailable' : `${fmt(m.elevationFt)} ft`}</span>}
        {m.path && (
          <Suspense fallback={<span className="text-muted-foreground">Loading elevation profile…</span>}>
            <ElevationProfile path={m.path} onCursor={onProfileCursor} />
          </Suspense>
        )}
      </div>
    </li>
  )
})

export default function Measure() {
  const { measure } = useMeasureMode()
  const { setMeasureMode: setMeasure } = useMap()
  const { measurements, highlightedId, setHighlight, setProfileCursor, clearAll } = useMeasurements()

  return (
    <div className="grid gap-3 md:gap-4">
      <h2 className="text-lg font-medium md:mb-4">Measure and Elevation Tools</h2>
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle>Measure</CardTitle>
          <CardDescription>{measure ? MEASURE_TOOLS[measure].hint : 'Pick a tool, then draw on the map.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <RadioGroup
            aria-label="Measure tool"
            value={measure ?? null}
            onValueChange={(v) => setMeasure(isMeasureMode(v) ? v : undefined)}
            className="grid grid-cols-3 gap-2"
          >
            {MEASURE_MODES.map((mode) => {
              const { label, icon: Icon } = MEASURE_TOOLS[mode]
              return (
                <Radio.Root
                  key={mode}
                  value={mode}
                  // Clicking the active tool again turns measuring off
                  onClick={() => measure === mode && setMeasure(undefined)}
                  className="flex flex-col items-center gap-1 rounded-sm bg-popover p-2 text-sm md:p-3 hover:bg-accent hover:text-accent-foreground data-[checked]:bg-primary data-[checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="size-4" />
                  {label}
                </Radio.Root>
              )
            })}
          </RadioGroup>
          <p className="mt-3 text-xs text-muted-foreground">
            Distances and areas are horizontal, measured flat on the map as the crow flies. They don't follow the terrain, even in 3D.
          </p>
        </CardContent>
      </Card>

      {measurements.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between p-4 md:p-6">
            <CardTitle>Results</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-4" /> Clear
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <ul className="grid gap-2">
              {measurements.map((m, i) => <MeasurementRow key={m.id} m={m} index={i} highlighted={m.id === highlightedId} onHighlight={setHighlight} onProfileCursor={setProfileCursor} />)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
