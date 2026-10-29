import { useSyncExternalStore } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMapInstance } from '@/context/map-instance-context'
import { getMeasureControl, subscribeMeasureControls, type MeasureMode, type Measurement } from '@/lib/map/measure-store'

const NO_MEASUREMENTS: Measurement[] = []
const noop = () => () => {}

/** The active measure tool, kept in the URL like the other map modes. */
export function useMeasureMode() {
  const { measure } = useSearch({ from: '/_map' })
  const navigate = useNavigate()
  const setMeasure = (mode: MeasureMode | undefined) =>
    navigate({ to: '.', search: (prev) => ({ ...prev, measure: mode }), replace: true })
  return { measure, setMeasure }
}

/** The map's measure control and its finished measurements, live. */
export function useMeasurements() {
  const { map } = useMapInstance()
  const control = useSyncExternalStore(subscribeMeasureControls, () => getMeasureControl(map))
  const measurements = useSyncExternalStore(control?.subscribe ?? noop, () => control?.measurements ?? NO_MEASUREMENTS)
  return { measurements, clearAll: () => control?.clearAll() }
}
