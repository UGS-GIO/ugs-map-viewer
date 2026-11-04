import { useState, useSyncExternalStore } from 'react'
import { Popover } from '@base-ui/react/popover'
import { History, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MapStep, MapSteps } from '@/lib/map/map-steps'

function StepLabelInput({ step, onDone }: { step: MapStep; onDone: (label?: string) => void }) {
  return (
    <input
      autoFocus
      defaultValue={step.label ?? ''}
      placeholder={step.summary}
      aria-label={`Label for step ${step.index + 1}`}
      className='min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs text-foreground'
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(e.currentTarget.value)
        if (e.key === 'Escape') {
          // Cancel the edit without closing the popover
          e.stopPropagation()
          onDone()
        }
      }}
      onBlur={(e) => onDone(e.currentTarget.value)}
    />
  )
}

/**
 * The map history as a list: jump to any step, and label the ones worth coming back to. Steps are
 * browser history entries, so they can't be removed; a label is how you mark the ones that matter.
 */
export function MapStepsPopover({ steps: store }: { steps: MapSteps }) {
  const { steps, current } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [editing, setEditing] = useState<number>()

  const finishEditing = (index: number, label?: string) => {
    if (label !== undefined) store.setLabel(index, label)
    setEditing(undefined)
  }

  return (
    <Popover.Root>
      <Popover.Trigger className='maplibregl-ctrl-icon' title='Map history' aria-label='Map history'>
        <History size={18} strokeWidth={2} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side='right' align='start' sideOffset={8} className='z-50'>
          <Popover.Popup className='w-72 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none'>
            <div className='mb-1.5 flex items-center justify-between border-b border-border pb-1'>
              <Popover.Title className='text-xs font-medium leading-none text-foreground'>Map history</Popover.Title>
              <Popover.Close aria-label='Close' className='flex size-4 items-center justify-center text-muted-foreground hover:text-foreground'>
                <X size={14} />
              </Popover.Close>
            </div>
            <ol className='max-h-80 overflow-y-auto' aria-label='Map history steps'>
              {[...steps].reverse().map((step) => (
                <li key={step.index} className='flex items-center gap-1'>
                  {editing === step.index ? (
                    <StepLabelInput step={step} onDone={(label) => finishEditing(step.index, label)} />
                  ) : (
                    <button
                      type='button'
                      aria-current={step.index === current ? 'step' : undefined}
                      onClick={() => store.go(step.index)}
                      className={cn(
                        'flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground',
                        step.index === current && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                      )}
                    >
                      <span className='w-4 shrink-0 text-right tabular-nums opacity-60'>{step.index + 1}</span>
                      <span className='min-w-0 flex-1 truncate'>
                        {step.label ? <><span className='font-medium'>{step.label}</span> <span className='opacity-70'>· {step.summary}</span></> : step.summary}
                      </span>
                    </button>
                  )}
                  <button
                    type='button'
                    title={step.label ? 'Rename step' : 'Label step'}
                    aria-label={`${step.label ? 'Rename' : 'Label'} step ${step.index + 1}`}
                    onClick={() => setEditing(step.index)}
                    className='flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  >
                    <Pencil size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ol>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
