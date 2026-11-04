import { useState, useSyncExternalStore } from 'react'
import { Popover } from '@base-ui/react/popover'
import { useMutation } from '@tanstack/react-query'
import { History, Link, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MapStep, MapSteps } from '@/lib/map/map-steps'
import { buildStopsLink, toStopHref, type SharedStops } from '@/lib/map/shared-stops'

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
 * Labeled steps share as one link, which opens with them listed as stops.
 */
export function MapStepsPopover({ steps: store, shared }: { steps: MapSteps; shared: SharedStops }) {
  const { steps, current } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { stops, unseen } = useSyncExternalStore(shared.subscribe, shared.getSnapshot)
  const [editing, setEditing] = useState<number>()
  const [open, setOpen] = useState(false)
  const labeled = steps.filter((step) => step.label)

  const copyLink = useMutation({
    mutationFn: async () => {
      const link = await buildStopsLink(window.location.origin, labeled.map((step) => ({ label: step.label ?? '', href: toStopHref(step.href) })))
      await navigator.clipboard.writeText(link)
    },
    onSuccess: () => toast.success(`Link to ${labeled.length} ${labeled.length === 1 ? 'stop' : 'stops'} copied`),
    onError: (error) => {
      console.error('Could not copy the share link:', error)
      toast.error('Could not copy the link. Please try again.')
    },
  })

  const finishEditing = (index: number, label?: string) => {
    if (label !== undefined) store.setLabel(index, label)
    setEditing(undefined)
  }

  return (
    <Popover.Root
      open={open || unseen}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) shared.markSeen()
      }}
    >
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
            {stops.length > 0 && (
              <section aria-label='Shared stops' className='mb-2 border-b border-border pb-2'>
                <div className='mb-1 flex items-center justify-between'>
                  <h3 className='text-xs font-medium text-muted-foreground'>Shared stops</h3>
                  <button type='button' onClick={shared.clear} className='text-xs text-muted-foreground hover:text-foreground'>Clear</button>
                </div>
                <ol>
                  {stops.map((stop, i) => (
                    <li key={`${i}-${stop.href}`}>
                      <button
                        type='button'
                        onClick={() => shared.open(stop)}
                        className='flex w-full items-baseline gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground'
                      >
                        <span className='w-4 shrink-0 text-right tabular-nums opacity-60'>{String.fromCharCode(65 + (i % 26))}</span>
                        <span className='min-w-0 flex-1 truncate font-medium'>{stop.label}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
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
            <button
              type='button'
              onClick={() => copyLink.mutate()}
              disabled={labeled.length === 0 || copyLink.isPending}
              title={labeled.length === 0 ? 'Label the steps to share first' : undefined}
              className='mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
            >
              <Link size={12} aria-hidden />
              {labeled.length === 0 ? 'Label steps to share them' : `Copy link to ${labeled.length} labeled ${labeled.length === 1 ? 'step' : 'steps'}`}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
