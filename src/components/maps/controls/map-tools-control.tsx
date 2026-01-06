import { createPortal } from 'react-dom'
import { useControl } from 'react-map-gl/maplibre'
import { PortalControl } from './portal-control'
import { Square, Pentagon, X, Crosshair, CopyPlus } from 'lucide-react'

export type DrawMode = 'off' | 'rectangle' | 'polygon'

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
  position = 'top-right',
}: MapToolsControlProps) {
  const control = useControl<PortalControl>(
    () => new PortalControl(),
    { position }
  )

  const container = control?.getContainer()

  // MapLibre native button styling
  const buttonStyle: React.CSSProperties = {
    width: 29,
    height: 29,
    padding: 0,
    border: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    color: '#333',
  }

  const activeStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    color: '#000',
  }

  return container
    ? createPortal(
        <>
          {/* Draw rectangle */}
          {onDrawModeChange && (
            <button
              type="button"
              className="maplibregl-ctrl-icon"
              style={drawMode === 'rectangle' ? activeStyle : buttonStyle}
              onClick={() => onDrawModeChange(drawMode === 'rectangle' ? 'off' : 'rectangle')}
              title="Draw rectangle filter"
            >
              <Square size={18} strokeWidth={1.5} />
            </button>
          )}

          {/* Draw polygon */}
          {onDrawModeChange && (
            <button
              type="button"
              className="maplibregl-ctrl-icon"
              style={drawMode === 'polygon' ? activeStyle : buttonStyle}
              onClick={() => onDrawModeChange(drawMode === 'polygon' ? 'off' : 'polygon')}
              title="Draw polygon filter"
            >
              <Pentagon size={18} strokeWidth={1.5} />
            </button>
          )}

          {/* Clear filter */}
          {hasFilter && onClearFilter && (
            <button
              type="button"
              className="maplibregl-ctrl-icon"
              style={{ ...buttonStyle, color: '#dc2626' }}
              onClick={onClearFilter}
              title="Clear spatial filter"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          )}

          {/* Box select */}
          {onBoxSelectToggle && (
            <button
              type="button"
              className="maplibregl-ctrl-icon"
              style={boxSelectActive ? activeStyle : buttonStyle}
              onClick={() => onBoxSelectToggle(!boxSelectActive)}
              title={boxSelectActive ? 'Exit box select' : 'Box select mode'}
            >
              <Crosshair size={18} strokeWidth={1.5} />
            </button>
          )}

          {/* Multi-select toggle */}
          {onAdditiveModeToggle && (
            <button
              type="button"
              className="maplibregl-ctrl-icon"
              style={isAdditiveMode ? activeStyle : buttonStyle}
              onClick={onAdditiveModeToggle}
              title={isAdditiveMode ? 'Multi-select ON (click to disable)' : 'Multi-select OFF (click or hold Shift)'}
            >
              <CopyPlus size={18} strokeWidth={1.5} />
            </button>
          )}
        </>,
        container
      )
    : null
}
