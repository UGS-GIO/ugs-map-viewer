import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioTiles } from '@/components/ui/radio-tiles'
import { useMeasureMode, useMeasurements } from '@/hooks/use-measure'
import { useMap } from '@/hooks/use-map'
import { MEASURE_MODES, formatArea, formatLength, formatQuantity, type Measurement, type UnitSystem } from '@/lib/map/measure-store'
import { useUnits } from '@/hooks/use-units'
import { UnitsToggle } from './units-card'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'
import { MeasurementRow } from './measurement-row'

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
  const { measurements, highlightedId, setHighlight, setProfilePoint, remove, clearAll } = useMeasurements()
  const { units } = useUnits()
  const totals = measurementTotals(measurements, units)

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="mb-2 text-lg font-medium">Measure and Elevation Tools</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Measure</CardTitle>
          <CardDescription>{measure ? MEASURE_TOOLS[measure].hint : 'Pick a tool, then draw on the map.'}</CardDescription>
        </CardHeader>
        <CardContent>
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
          <UnitsToggle className="mt-3" />
          <p className="mt-3 text-xs text-muted-foreground">
            Distances and areas are measured flat on the map, as the crow flies, even in 3D. Lines and areas also show their size along the ground, following the terrain.
          </p>
        </CardContent>
      </Card>

      {measurements.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Results</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-4" /> Clear
            </Button>
          </CardHeader>
          {totals && <p className="px-6 pb-2 text-sm text-muted-foreground">{totals}</p>}
          <CardContent>
            <ul className="grid gap-2">
              {measurements.map((m, i) => <MeasurementRow key={m.id} m={m} units={units} index={i} highlighted={m.id === highlightedId} onHighlight={setHighlight} onProfilePoint={setProfilePoint} onRemove={remove} />)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
