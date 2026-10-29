import { useEffect } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import '@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css'
import { HeadlessMeasureControl } from '@/lib/map/measure'
import { registerMeasureControl } from '@/lib/map/measure-store'
import { useMeasureMode } from '@/hooks/use-measure'

export default function MeasureMapControl() {
  const { measure } = useMeasureMode()
  const control = useControl(
    () => new HeadlessMeasureControl(),
    ({ map }) => registerMeasureControl(map.getMap(), control),
    ({ map }) => registerMeasureControl(map.getMap(), undefined),
    { position: 'top-right' },
  )

  // Terra Draw is imperative; follow the URL's tool
  useEffect(() => {
    control.setMeasureMode(measure)
  }, [control, measure])

  return null
}
