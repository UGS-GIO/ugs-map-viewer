import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useControl } from 'react-map-gl/maplibre'
import { useQueryClient } from '@tanstack/react-query'
import { MeasureControl } from '@/lib/map/measure'
import { useMeasureMode } from '@/hooks/use-measure'

export default function MeasureMapControl() {
  const { measure } = useMeasureMode()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const control = useControl(
    () => new MeasureControl(queryClient),
    { position: 'top-right' },
  )

  // Terra Draw is imperative; follow the URL's tool
  useEffect(() => {
    control.setMode(measure)
  }, [control, measure])

  // Results show in the sidebar, so open it on the first one in case measuring started from the map
  useEffect(
    () => control.onFirstResult(() => navigate({ to: '.', search: (prev) => ({ ...prev, tab: 'measure', sidebar_collapsed: undefined }), replace: true })),
    [control, navigate],
  )

  return null
}
