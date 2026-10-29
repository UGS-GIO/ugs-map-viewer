import { createPortal } from 'react-dom'
import { useControl } from 'react-map-gl/maplibre'
import { PortalControl } from './portal-control'
import { ControlButton } from './control-button'
import { Square, Pentagon, X, SquareDashedMousePointer, CopyPlus, Ruler, Spline, LandPlot, MapPin, Trash2 } from 'lucide-react'
import type { DrawMode } from '../types'
import type { MeasureMode } from '@/lib/map/measure-store'

const MEASURE_TOOLS = [
  { mode: 'linestring', icon: Spline, label: 'Measure distance' },
  { mode: 'polygon', icon: LandPlot, label: 'Measure area' },
  { mode: 'point', icon: MapPin, label: 'Point location and elevation' },
] as const satisfies ReadonlyArray<{ mode: MeasureMode; icon: typeof Ruler; label: string }>

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
  // Measure
  measureMode?: MeasureMode
  onMeasureModeChange?: (mode: MeasureMode | undefined) => void
  hasMeasurements?: boolean
  onClearMeasurements?: () => void
  // Pin marker
  hasPin?: boolean
  onClearPin?: () => void
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
  measureMode,
  onMeasureModeChange,
  hasMeasurements = false,
  onClearMeasurements,
  position = 'top-right',
}: MapToolsControlProps) {
  const control = useControl<PortalControl>(
    () => new PortalControl(),
    { position }
  )

  const container = control?.getContainer()

  const isModeActive = drawMode !== 'off' || boxSelectActive || isAdditiveMode || !!measureMode

  // Determine active mode label for the indicator
  const getActiveModeLabel = (): string | null => {
    if (drawMode === 'rectangle') return 'Rectangle draw'
    if (drawMode === 'polygon') return 'Polygon draw'
    if (boxSelectActive) return 'Box select'
    if (isAdditiveMode) return 'Multi-select'
    if (measureMode) return MEASURE_TOOLS.find((t) => t.mode === measureMode)?.label ?? null
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

          {/* Measure: one ruler button; the tools open while measuring or while results are on the map */}
          {onMeasureModeChange && (
            <ControlButton
              icon={Ruler}
              title={measureMode ? 'Stop measuring' : 'Measure'}
              onClick={() => onMeasureModeChange(measureMode ? undefined : 'linestring')}
              active={!!measureMode}
            />
          )}
          {onMeasureModeChange && (measureMode || hasMeasurements) && (
            <>
              {MEASURE_TOOLS.map(({ mode, icon, label }) => (
                <ControlButton
                  key={mode}
                  icon={icon}
                  title={label}
                  onClick={() => onMeasureModeChange(measureMode === mode ? undefined : mode)}
                  active={measureMode === mode}
                />
              ))}
              {hasMeasurements && onClearMeasurements && (
                <ControlButton icon={Trash2} title="Clear measurements" onClick={onClearMeasurements} variant="danger" />
              )}
            </>
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
          {activeModeLabel && (
            <div className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground shadow-sm">
              {activeModeLabel}
            </div>
          )}
        </div>,
        container
      )
    : null
}
