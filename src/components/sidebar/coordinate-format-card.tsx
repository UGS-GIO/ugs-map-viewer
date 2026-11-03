import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { radioTileClass } from '@/components/ui/radio-tile'
import { cn } from '@/lib/utils'
import { useCoordinateFormat } from '@/hooks/use-map-coordinates'
import type { CoordinateFormat } from '@/lib/map/conversion-utils'

const OPTIONS: { value: CoordinateFormat; label: string }[] = [
  { value: 'dd', label: 'Decimal Degrees' },
  { value: 'dms', label: 'Degrees, Minutes, Seconds' },
  { value: 'utm', label: 'UTM Zone 12N (NAD83)' },
]

export function CoordinateFormatCard() {
  const { coordinateFormat, setCoordinateFormat } = useCoordinateFormat()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Coordinate Format</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          aria-label="Location coordinate format"
          value={coordinateFormat}
          onValueChange={setCoordinateFormat}
          className="grid gap-2"
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
      </CardContent>
    </Card>
  )
}
