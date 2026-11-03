import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { radioTileClass } from '@/components/ui/radio-tile'
import { useUnits } from '@/hooks/use-units'
import { cn } from '@/lib/utils'
import { isUnitSystem, type UnitSystem } from '@/lib/map/measure-store'

const OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'us', label: 'US (ft, mi, acres)' },
  { value: 'metric', label: 'Metric (m, km, ha)' },
]

/** US/metric switch; the Measure panel shows the same setting as Map Configurations. */
export function UnitsToggle({ className }: { className?: string }) {
  const { units, setUnits } = useUnits()
  return (
    <RadioGroup
      aria-label="Measurement units"
      value={units}
      onValueChange={(v) => isUnitSystem(v) && setUnits(v)}
      className={cn('grid grid-cols-2 gap-2', className)}
    >
      {OPTIONS.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          className={cn(radioTileClass, 'text-center')}
        >
          {o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
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
