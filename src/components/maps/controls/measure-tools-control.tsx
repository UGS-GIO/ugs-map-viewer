import { createPortal } from 'react-dom'
import { useControl } from 'react-map-gl/maplibre'
import { Check, Ruler, Trash2 } from 'lucide-react'
import { PortalControl } from './portal-control'
import { ControlButton } from './control-button'
import { ActiveModeLabel } from './active-mode-label'
import { MEASURE_MODES } from '@/lib/map/measure-store'
import { MEASURE_TOOLS } from '../measure-tools'
import { useMeasureMode, useMeasureToolbar } from '@/hooks/use-measure'
import { useMap } from '@/hooks/use-map'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMapInstance } from '@/context/map-instance-context'
import { Button } from '@/components/ui/button'

/** Measure tools in their own group, so the ruler (not the filter group's X) turns measuring off. */
export function MeasureToolsControl() {
  const control = useControl<PortalControl>(() => new PortalControl(), { position: 'top-right' })
  const container = control?.getContainer()
  const { measure: measureMode } = useMeasureMode()
  // Goes through the map container so turning measuring on ends the other modes
  const { setMeasureMode: onMeasureModeChange } = useMap()
  const { hasMeasurements, drawing, finish, clear } = useMeasureToolbar()
  const mapContainer = useMapInstance().map?.getContainer()
  // Touch has no Enter key and double-tapping the last point isn't discoverable
  const showFinish = useIsMobile() && drawing && measureMode !== 'point' && finish

  return container
    ? createPortal(
        <div className="relative">
          <ControlButton
            icon={Ruler}
            title={measureMode ? 'Stop measuring' : 'Measure'}
            onClick={() => onMeasureModeChange(measureMode ? undefined : 'linestring')}
            active={!!measureMode}
          />
          {/* The tools open while measuring or while results are on the map */}
          {(measureMode || hasMeasurements) && MEASURE_MODES.map((mode) => (
            <ControlButton
              key={mode}
              icon={MEASURE_TOOLS[mode].icon}
              title={MEASURE_TOOLS[mode].title}
              onClick={() => onMeasureModeChange(measureMode === mode ? undefined : mode)}
              active={measureMode === mode}
            />
          ))}
          {hasMeasurements && clear && <ControlButton icon={Trash2} title="Clear measurements" onClick={clear} variant="danger" />}
          {measureMode && <ActiveModeLabel>{MEASURE_TOOLS[measureMode].title}</ActiveModeLabel>}
          {/* Floats over the map: the control group clips anything hanging off its side */}
          {showFinish && mapContainer && createPortal(
            <Button onClick={finish} className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-lg">
              <Check className="size-4" />
              {measureMode === 'polygon' ? 'Close shape' : 'Finish line'}
            </Button>,
            mapContainer,
          )}
        </div>,
        container,
      )
    : null
}
