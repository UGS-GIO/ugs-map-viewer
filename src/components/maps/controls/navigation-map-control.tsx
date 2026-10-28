import { createPortal } from 'react-dom'
import { NavigationControl } from 'maplibre-gl'
import { useControl } from 'react-map-gl/maplibre'
import { useAppTerrain } from '@/hooks/use-app-terrain'

/**
 * Zoom, compass and a 3D toggle in one button group, so 3D doesn't add another control to a crowded
 * corner. visualizePitch: the compass shows tilt, and clicking it resets pitch and bearing.
 */
export function NavigationMapControl() {
  const control = useControl(() => new NavigationControl({ visualizePitch: true }), { position: 'top-left' })
  const { terrain, setTerrain } = useAppTerrain()

  return createPortal(
    <button
      type="button"
      // Same active look as ControlButton; `!` beats the ctrl-group hover rule's colour
      className="text-xs font-bold aria-pressed:!bg-primary aria-pressed:!text-white aria-pressed:hover:!bg-primary/90"
      title={terrain ? 'Switch to 2D' : 'Switch to 3D'}
      aria-label={terrain ? 'Switch to 2D' : 'Switch to 3D'}
      aria-pressed={terrain}
      onClick={() => setTerrain(!terrain)}
    >
      3D
    </button>,
    control._container,
  )
}
