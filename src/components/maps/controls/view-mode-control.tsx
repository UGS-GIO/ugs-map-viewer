import { createPortal } from 'react-dom'
import { useControl } from 'react-map-gl/maplibre'
import { PortalControl } from './portal-control'
import { ControlButton } from './control-button'
import { Map, Columns2, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/use-map-url-sync'

interface ViewModeControlProps {
  mode: ViewMode
  hasResults: boolean
  onModeChange: (mode: ViewMode) => void
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const modes = [
  { value: 'map' as const, label: 'Map view', Icon: Map },
  { value: 'split' as const, label: 'Split view', Icon: Columns2 },
  { value: 'table' as const, label: 'Table view', Icon: Table2 },
]

export function ViewModeControl({
  mode,
  hasResults,
  onModeChange,
  position = 'top-right',
}: ViewModeControlProps) {
  const control = useControl<PortalControl>(
    () => new PortalControl('maplibregl-ctrl'),
    { position }
  )

  const container = control?.getContainer()

  return container
    ? createPortal(
        <div
          className="flex rounded bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_2px_hsl(var(--border))]"
          data-tour="view-mode"
        >
          {modes.map(({ value, label, Icon }, i) => {
            const isDisabled = !hasResults && value !== 'map'
            const title = isDisabled ? 'Select features on the map first' : label
            const isFirst = i === 0
            const isLast = i === modes.length - 1

            return (
              <ControlButton
                key={value}
                icon={Icon}
                title={title}
                onClick={() => onModeChange(value)}
                active={mode === value}
                disabled={isDisabled}
                className={cn(
                  isFirst && 'rounded-l',
                  isLast && 'rounded-r',
                  value === 'split' && '[&>svg]:rotate-90',
                )}
              />
            )
          })}
        </div>,
        container
      )
    : null
}
