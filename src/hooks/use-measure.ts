import { useCallback, useSyncExternalStore } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMapInstance } from '@/context/map-instance-context'
import { getMeasureControl, subscribeMeasureControls, type MeasureMode, type Measurement } from '@/lib/map/measure-store'

const NO_MEASUREMENTS: Measurement[] = []
const noop = () => () => {}

/** The active measure tool, kept in the URL like the other map modes. */
export function useMeasureMode() {
  const measure = useSearch({ from: '/_map', select: (s) => s.measure })
  const navigate = useNavigate()
  const setMeasure = useCallback(
    (mode: MeasureMode | undefined) => navigate({ to: '.', search: (prev) => ({ ...prev, measure: mode }), replace: true }),
    [navigate],
  )
  return { measure, setMeasure }
}

/** The map's measure control and its finished measurements, live. */
export function useMeasurements() {
  const { map } = useMapInstance()
  const control = useSyncExternalStore(subscribeMeasureControls, () => getMeasureControl(map))
  const measurements = useSyncExternalStore(control?.subscribe ?? noop, () => control?.measurements ?? NO_MEASUREMENTS)
  const highlightedId = useSyncExternalStore(control?.subscribeHighlight ?? noop, () => control?.highlightedId)
  return { measurements, highlightedId, setHighlight: control?.setHighlight, clearAll: () => control?.clear() }
}

/** Whether any measurement is on the map; a boolean so drawing doesn't re-render the map container. */
export function useHasMeasurements() {
  const { map } = useMapInstance()
  const control = useSyncExternalStore(subscribeMeasureControls, () => getMeasureControl(map))
  const hasMeasurements = useSyncExternalStore(control?.subscribe ?? noop, () => (control?.measurements.length ?? 0) > 0)
  return { hasMeasurements, clearAll: () => control?.clear() }
}
