import { lazy, memo, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { surfaceStats } from '@/lib/map/dem-elevation'
import { Trash2, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioTiles } from '@/components/ui/radio-tiles'
import { cn } from '@/lib/utils'
import { useMeasureMode, useMeasurements } from '@/hooks/use-measure'
import { useMap } from '@/hooks/use-map'
import { useCoordinateFormat } from '@/hooks/use-map-coordinates'
import { formatCoordinatePair } from '@/lib/map/conversion-utils'
import { MEASURE_MODES, formatArea, formatElevation, formatLength, formatQuantity, measurementQuantity, type Measurement, type UnitSystem } from '@/lib/map/measure-store'
import { useUnits } from '@/hooks/use-units'
import { UnitsToggle } from './units-card'
import { LoadShapes } from './load-shapes'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'

// Recharts is heavy; load it only once a line is finished
const ElevationProfile = lazy(() => import('./elevation-profile'))

/** Surface area and mean slope of a finished polygon, from the DEM. */
function AreaTerrain({ ring, areaM2, units }: { ring: [number, number][]; areaM2: number; units: UnitSystem }) {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({
    queryKey: ['surface-stats', ring],
    queryFn: () => surfaceStats(queryClient, ring, areaM2),
    staleTime: Infinity,
  })
  if (isPending) return <span className="text-muted-foreground">Measuring the terrain…</span>
  if (isError) return <span className="text-muted-foreground">Terrain stats unavailable</span>
  return (
    <>
      <span>Along the ground: {formatQuantity(formatArea(data.surfaceAreaM2, units))}</span>
      <span className="text-muted-foreground">Mean slope: {Math.round(data.meanSlopeDeg)}°</span>
    </>
  )
}

// Memoized: measurements keep their object while unchanged, so drawing doesn't re-render finished rows
const MeasurementRow = memo(function MeasurementRow({ m, units, index, highlighted, onHighlight, onProfileCursor, onRemove }: {
  m: Measurement
  units: UnitSystem
  index: number
  highlighted: boolean
  onHighlight?: (id: string | number | undefined) => void
  onProfileCursor?: (at: [number, number] | undefined) => void
  onRemove?: (id: string | number) => void
}) {
  const { coordinateFormat } = useCoordinateFormat()
  const { label, icon: Icon } = MEASURE_TOOLS[m.mode]
  const size = m.mode === 'point' ? undefined : measurementQuantity(m, units)
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
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{label} {index + 1}</span>
          {onRemove && (
            <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={`Remove ${label} ${index + 1}`} onClick={() => onRemove(m.id)}>
              <X className="size-4" />
            </Button>
          )}
        </div>
        {size && <span>{formatQuantity(size)}</span>}
        {m.segmentsM && m.segmentsM.length > 1 && (
          <span className="text-muted-foreground">Legs: {m.segmentsM.map((s) => formatQuantity(formatLength(s, units))).join(' · ')}</span>
        )}
        {m.perimeterM !== undefined && <span className="text-muted-foreground">Perimeter: {formatQuantity(formatLength(m.perimeterM, units))}</span>}
        {m.ring && m.areaM2 !== undefined && <AreaTerrain ring={m.ring} areaM2={m.areaM2} units={units} />}
        {coords?.map((c) => <span key={c.label}>{c.label}: {c.value}</span>)}
        {m.mode === 'point' && (
          <span>Elevation: {m.elevationM === undefined ? '…' : m.elevationM === null ? 'Unavailable' : formatQuantity(formatElevation(m.elevationM, units))}</span>
        )}
        {m.path && (
          <Suspense fallback={<span className="text-muted-foreground">Loading elevation profile…</span>}>
            <ElevationProfile path={m.path} units={units} onCursor={onProfileCursor} />
          </Suspense>
        )}
      </div>
    </li>
  )
})

/** Sums for lines and for areas, once there are two or more of a kind. */
function measurementTotals(measurements: Measurement[], units: UnitSystem) {
  const lines = measurements.flatMap((m) => m.lengthM ?? [])
  const areas = measurements.flatMap((m) => m.areaM2 ?? [])
  const parts = [
    lines.length > 1 && `${formatQuantity(formatLength(lines.reduce((a, b) => a + b, 0), units))} of lines`,
    areas.length > 1 && `${formatQuantity(formatArea(areas.reduce((a, b) => a + b, 0), units))} of areas`,
  ].filter(Boolean)
  return parts.length ? `Total: ${parts.join(' · ')}` : undefined
}

export default function Measure() {
  const { measure } = useMeasureMode()
  const { setMeasureMode } = useMap()
  const { measurements, highlightedId, setHighlight, setProfileCursor, remove, load, clearAll } = useMeasurements()
  const { units } = useUnits()
  const totals = measurementTotals(measurements, units)

  return (
    <div className="grid gap-3 md:gap-4">
      <h2 className="text-lg font-medium md:mb-4">Measure and Elevation Tools</h2>
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle>Measure</CardTitle>
          <CardDescription>{measure ? MEASURE_TOOLS[measure].hint : 'Pick a tool, then draw on the map.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <RadioTiles
            label="Measure tool"
            value={measure ?? null}
            onValueChange={setMeasureMode}
            // Clicking the active tool again turns measuring off
            onItemClick={(mode) => measure === mode && setMeasureMode(undefined)}
            options={MEASURE_MODES.map((mode) => {
              const { label, icon: Icon } = MEASURE_TOOLS[mode]
              return { value: mode, label: <><Icon className="size-4" />{label}</> }
            })}
            className="grid-cols-3"
            itemClassName="flex flex-col items-center gap-1"
          />
          <LoadShapes onLoad={load} />
          <UnitsToggle className="mt-3" />
          <p className="mt-3 text-xs text-muted-foreground">
            Distances and areas are measured flat on the map, as the crow flies, even in 3D. Lines and areas also show their size along the ground, following the terrain.
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
          {totals && <p className="px-4 pb-2 text-sm text-muted-foreground md:px-6">{totals}</p>}
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <ul className="grid gap-2">
              {measurements.map((m, i) => <MeasurementRow key={m.id} m={m} units={units} index={i} highlighted={m.id === highlightedId} onHighlight={setHighlight} onProfileCursor={setProfileCursor} onRemove={remove} />)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
