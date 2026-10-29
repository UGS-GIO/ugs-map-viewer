import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMeasureMode, useMeasurements } from '@/hooks/use-measure'
import { useCoordinateFormat } from '@/hooks/use-map-coordinates'
import { formatCoordinatePair } from '@/lib/map/conversion-utils'
import { MEASURE_MODES, isMeasureMode, type Measurement } from '@/lib/map/measure-store'
import { MEASURE_TOOLS } from '@/components/maps/measure-tools'

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function MeasurementRow({ m, index }: { m: Measurement; index: number }) {
  const { coordinateFormat } = useCoordinateFormat()
  const { label, icon: Icon } = MEASURE_TOOLS[m.mode]
  const coords = m.coordinates && formatCoordinatePair(m.coordinates[0], m.coordinates[1], coordinateFormat, 5)
  return (
    <li className="flex gap-3 rounded-sm bg-popover p-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid gap-0.5">
        <span className="font-medium">{label} {index + 1}</span>
        {m.value !== undefined && <span>{fmt(m.value)} {m.unit}</span>}
        {coords?.map((c) => <span key={c.label}>{c.label}: {c.value}</span>)}
        {m.mode === 'point' && <span>Elevation: {m.elevationFt === undefined ? '…' : `${fmt(m.elevationFt)} ft`}</span>}
      </div>
    </li>
  )
}

export default function Measure() {
  const { measure, setMeasure } = useMeasureMode()
  const { measurements, clearAll } = useMeasurements()

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Measure</CardTitle>
          <CardDescription>{measure ? MEASURE_TOOLS[measure].hint : 'Pick a tool, then draw on the map.'}</CardDescription>
        </CardHeader>
        <CardContent>
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
                  className="flex flex-col items-center gap-1 rounded-sm bg-popover p-3 text-sm hover:bg-accent hover:text-accent-foreground data-[checked]:bg-primary data-[checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="size-4" />
                  {label}
                </Radio.Root>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {measurements.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Results</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-4" /> Clear
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {measurements.map((m, i) => <MeasurementRow key={m.id} m={m} index={i} />)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
