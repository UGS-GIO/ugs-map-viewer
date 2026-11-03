import { useCallback, useSyncExternalStore } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMapInstance } from '@/context/map-instance-context'
import { getMeasureControl, subscribeMeasureControls, type MeasureMode, type Measurement } from '@/lib/map/measure-store'
import type { MeasureControl } from '@/lib/map/measure'

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

/** The map's measure control and a pick of its state; re-renders only when the pick changes. */
function useMeasureState<T>(pick: (control: MeasureControl | undefined) => T) {
  const { map } = useMapInstance()
  const control = useSyncExternalStore(subscribeMeasureControls, () => getMeasureControl(map))
  return { control, value: useSyncExternalStore(control?.subscribe ?? noop, () => pick(control)) }
}

/** The map's finished measurements and the one hovered, live. */
export function useMeasurements() {
  const { control, value: measurements } = useMeasureState((c) => c?.measurements ?? NO_MEASUREMENTS)
  const { value: highlightedId } = useMeasureState((c) => c?.highlightedId)
  return {
    measurements,
    highlightedId,
    setHighlight: control?.setHighlight,
    setProfilePoint: control?.setProfilePoint,
    remove: control?.remove,
    clearAll: () => control?.clear(),
  }
}

/** What the map's measure toolbar shows; booleans so drawing doesn't re-render it every move. */
export function useMeasureToolbar() {
  const { control, value: hasMeasurements } = useMeasureState((c) => (c?.measurements.length ?? 0) > 0)
  const { value: drawing } = useMeasureState((c) => c?.drawing ?? false)
  return { hasMeasurements, drawing, finish: control?.finish, clear: () => control?.clear() }
}
