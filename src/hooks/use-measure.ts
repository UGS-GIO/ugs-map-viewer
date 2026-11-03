import { useCallback, useSyncExternalStore } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useMapInstance } from '@/context/map-instance-context'
import { getMeasureControl, subscribeMeasureControls, type MeasureMode, type Measurement } from '@/lib/map/measure-store'
import type { LoadedShape } from '@/lib/map/measure-features'
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

/** The map's measure control, once it's mounted. */
function useMeasureControl() {
  const { map } = useMapInstance()
  return useSyncExternalStore(subscribeMeasureControls, () => getMeasureControl(map))
}

/** The control's state, picked so a component only re-renders when its pick changes. */
function useMeasureState<T>(pick: (control: MeasureControl | undefined) => T) {
  const control = useMeasureControl()
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
    setProfileCursor: control?.setProfileCursor,
    remove: control?.remove,
    load: control ? (shapes: LoadedShape[]) => control.load(shapes) : undefined,
    clearAll: () => control?.clear(),
  }
}

/** Whether a line or polygon is part-drawn, and a way to finish it. */
export function useMeasureDrawing() {
  const { control, value: drawing } = useMeasureState((c) => c?.drawing ?? false)
  return { drawing, finish: control?.finish }
}

/** Whether any measurement is on the map; a boolean so drawing doesn't re-render the map container. */
export function useHasMeasurements() {
  const { control, value: hasMeasurements } = useMeasureState((c) => (c?.measurements.length ?? 0) > 0)
  return { hasMeasurements, clearAll: () => control?.clear() }
}
