import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioTiles } from '@/components/ui/radio-tiles'
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
        <RadioTiles label="Location coordinate format" value={coordinateFormat} onValueChange={setCoordinateFormat} options={OPTIONS} />
      </CardContent>
    </Card>
  )
}
