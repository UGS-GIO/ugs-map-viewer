import { useEffect } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import { useQueryClient } from '@tanstack/react-query'
import { MeasureControl } from '@/lib/map/measure'
import { registerMeasureControl } from '@/lib/map/measure-store'
import { useMeasureMode } from '@/hooks/use-measure'

export default function MeasureMapControl() {
  const { measure } = useMeasureMode()
  const queryClient = useQueryClient()
  const control = useControl(
    () => new MeasureControl(queryClient),
    ({ map }) => registerMeasureControl(map.getMap(), control),
    ({ map }) => registerMeasureControl(map.getMap(), undefined),
    { position: 'top-right' },
  )

  // Terra Draw is imperative; follow the URL's tool
  useEffect(() => {
    control.setMode(measure)
  }, [control, measure])

  return null
}
