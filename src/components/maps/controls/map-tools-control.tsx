import { createPortal } from 'react-dom'
import { useControl } from 'react-map-gl/maplibre'
import { PortalControl } from './portal-control'
import { ControlButton } from './control-button'
import { Square, Pentagon, X, SquareDashedMousePointer, CopyPlus, MousePointerBan } from 'lucide-react'
import type { DrawMode } from '../types'
import { ActiveModeLabel } from './active-mode-label'

interface MapToolsControlProps {
  // Draw mode
  drawMode?: DrawMode
  onDrawModeChange?: (mode: DrawMode) => void
  hasFilter?: boolean
  onClearFilter?: () => void
  // Box select
  boxSelectActive?: boolean
  onBoxSelectToggle?: (active: boolean) => void
  // Multi-select / additive mode
  isAdditiveMode?: boolean
  onAdditiveModeToggle?: () => void
  // Cancel any active mode
  onCancelMode?: () => void
  // Pin marker
  hasPin?: boolean
  onClearPin?: () => void
  // Selected features
  hasSelection?: boolean
  onClearSelection?: () => void
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export function MapToolsControl({
  drawMode = 'off',
  onDrawModeChange,
  hasFilter = false,
  onClearFilter,
  boxSelectActive = false,
  onBoxSelectToggle,
  isAdditiveMode = false,
  onAdditiveModeToggle,
  onCancelMode,
  hasPin = false,
  onClearPin,
  hasSelection = false,
  onClearSelection,
  position = 'top-right',
}: MapToolsControlProps) {
  const control = useControl<PortalControl>(
    () => new PortalControl(),
    { position }
  )

  const container = control?.getContainer()

  const isModeActive = drawMode !== 'off' || boxSelectActive || isAdditiveMode

  // Determine active mode label for the indicator
  const getActiveModeLabel = (): string | null => {
    if (drawMode === 'rectangle') return 'Rectangle draw'
    if (drawMode === 'polygon') return 'Polygon draw'
    if (boxSelectActive) return 'Box select'
    if (isAdditiveMode) return 'Multi-select'
    return null
  }
  const activeModeLabel = getActiveModeLabel()

  return container
    ? createPortal(
        <div data-tour="map-tools" className="relative">
          {/* Draw rectangle */}
          {onDrawModeChange && (
            <ControlButton
              icon={Square}
              title="Draw rectangle filter"
              onClick={() => onDrawModeChange(drawMode === 'rectangle' ? 'off' : 'rectangle')}
              active={drawMode === 'rectangle'}
            />
          )}

          {/* Draw polygon */}
          {onDrawModeChange && (
            <ControlButton
              icon={Pentagon}
              title="Draw polygon filter"
              onClick={() => onDrawModeChange(drawMode === 'polygon' ? 'off' : 'polygon')}
              active={drawMode === 'polygon'}
            />
          )}

          {/* Clear filter */}
          {hasFilter && onClearFilter && (
            <ControlButton
              icon={X}
              title="Clear spatial filter"
              onClick={onClearFilter}
              variant="danger"
            />
          )}

          {/* Clear pin marker */}
          {hasPin && onClearPin && (
            <ControlButton
              icon={X}
              title="Clear pin marker"
              onClick={onClearPin}
              variant="danger"
            />
          )}

          {/* Clear selected features */}
          {hasSelection && onClearSelection && (
            <ControlButton
              icon={MousePointerBan}
              title="Clear selection"
              onClick={onClearSelection}
              variant="danger"
            />
          )}

          {/* Box select */}
          {onBoxSelectToggle && (
            <ControlButton
              icon={SquareDashedMousePointer}
              title={boxSelectActive ? 'Exit box select' : 'Box select mode'}
              onClick={() => onBoxSelectToggle(!boxSelectActive)}
              active={boxSelectActive}
            />
          )}

          {/* Multi-select toggle */}
          {onAdditiveModeToggle && (
            <ControlButton
              icon={CopyPlus}
              title={isAdditiveMode ? 'Multi-select ON (click to disable)' : 'Multi-select OFF (click or hold Shift)'}
              onClick={onAdditiveModeToggle}
              active={isAdditiveMode}
            />
          )}

          {/* Cancel active mode */}
          {isModeActive && onCancelMode && (
            <ControlButton
              icon={X}
              title="Cancel active mode"
              onClick={onCancelMode}
              variant="danger"
            />
          )}

          {/* Active mode indicator */}
          {activeModeLabel && <ActiveModeLabel>{activeModeLabel}</ActiveModeLabel>}
        </div>,
        container
      )
    : null
}
