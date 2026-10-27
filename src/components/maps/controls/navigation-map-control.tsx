import { createPortal } from 'react-dom'
import { NavigationControl } from 'maplibre-gl'
import { useControl, useMap } from 'react-map-gl/maplibre'
import { useAppTerrain } from '@/hooks/use-app-terrain'

const TILT_3D = 60

/**
 * Zoom, compass and a 3D toggle in one button group, so 3D doesn't add another control to a crowded
 * corner. visualizePitch: the compass shows tilt, and clicking it resets pitch and bearing.
 */
export function NavigationMapControl() {
  const control = useControl(() => new NavigationControl({ visualizePitch: true }), { position: 'top-left' })
  const { current: map } = useMap()
  const { terrain, setSetting } = useAppTerrain()

  // Tilt on the way in so the switch visibly does something; flatten on the way out
  const handleToggle = () => {
    setSetting('terrain', !terrain)
    map?.easeTo(terrain ? { pitch: 0, bearing: 0 } : { pitch: TILT_3D })
  }

  return createPortal(
    <button
      type="button"
      className="text-xs font-bold aria-pressed:text-primary"
      title={terrain ? 'Switch to 2D' : 'Switch to 3D'}
      aria-label={terrain ? 'Switch to 2D' : 'Switch to 3D'}
      aria-pressed={terrain}
      onClick={handleToggle}
    >
      3D
    </button>,
    control._container,
  )
}
