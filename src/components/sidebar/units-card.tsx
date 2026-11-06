import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioTiles } from '@/components/ui/radio-tiles'
import { useUnits } from '@/hooks/use-units'

/** US/metric switch; the Measure panel shows the same setting as Map Configurations. */
export function UnitsToggle({ className }: { className?: string }) {
  const { units, setUnits } = useUnits()
  return (
    <RadioTiles
      label="Measurement units"
      value={units}
      onValueChange={setUnits}
      options={[
        { value: 'us', label: 'US (ft, mi, acres)' },
        { value: 'metric', label: 'Metric (m, km, ha)' },
      ]}
      className={`grid-cols-2 ${className ?? ''}`}
    />
  )
}

export function UnitsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measurement Units</CardTitle>
      </CardHeader>
      <CardContent>
        <UnitsToggle />
      </CardContent>
    </Card>
  )
}
