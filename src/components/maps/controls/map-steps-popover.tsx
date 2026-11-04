import { useRef, useState, useSyncExternalStore } from 'react'
import { Popover } from '@base-ui/react/popover'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMap } from 'react-map-gl/maplibre'
import { FileDown, History, Link, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MapStep, MapSteps } from '@/lib/map/map-steps'
import { buildStopsLink, stopLetter, toStopHref, type SharedStop, type SharedStops } from '@/lib/map/shared-stops'
import type { GetLegendData } from './export-control'

const ROW = 'flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground'
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function StepLabelInput({ step, onDone }: { step: MapStep; onDone: (label?: string) => void }) {
  // Enter or Escape ends the edit; the blur that follows must not end it again with the typed value
  const ended = useRef(false)
  const end = (label?: string) => {
    if (ended.current) return
    ended.current = true
    onDone(label)
  }
  return (
    <input
      autoFocus
      defaultValue={step.label ?? ''}
      placeholder={step.summary}
      aria-label={`Label for step ${step.index + 1}`}
      className='min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs text-foreground'
      onKeyDown={(e) => {
        if (e.key === 'Enter') end(e.currentTarget.value)
        if (e.key === 'Escape') {
          // Cancel the edit without closing the popover
          e.stopPropagation()
          end()
        }
      }}
      onBlur={(e) => end(e.currentTarget.value)}
    />
  )
}

/** Jump to any step, label the ones that matter, and share them as a link or PDF. */
export function MapStepsPopover({ steps: store, shared, getLegendData }: { steps: MapSteps; shared: SharedStops; getLegendData?: GetLegendData }) {
  const { steps, current } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const { stops, unseen } = useSyncExternalStore(shared.subscribe, shared.getSnapshot)
  const [editing, setEditing] = useState<number>()
  const [open, setOpen] = useState(false)
  const { current: mapRef } = useMap()
  const queryClient = useQueryClient()

  // Opening a shared stop is a new step, so it carries the stop's label into this history
  const openStop = (stop: SharedStop) => {
    shared.open(stop)
    store.setLabel(store.getSnapshot().current, stop.label)
  }

  // Shared stops plus your own labeled steps; a visited stop carries its stop's label, so it isn't counted twice
  const stopLabels = new Set(stops.map((stop) => stop.label))
  const ownLabeled = steps.filter((step) => step.label && !stopLabels.has(step.label))
  const sharing: SharedStop[] = [...stops, ...ownLabeled.map((step) => ({ label: step.label ?? '', href: toStopHref(step.href) }))]
  const sharingWhat = stops.length > 0 ? plural(sharing.length, 'stop') : plural(sharing.length, 'labeled step')

  const copyLink = useMutation({
    mutationFn: async () => navigator.clipboard.writeText(buildStopsLink(window.location.origin, sharing)),
    onSuccess: () => toast.success(`Link to ${sharingWhat} copied`),
    onError: (error) => {
      console.error('Could not copy the share link:', error)
      toast.error('Could not copy the link. Please try again.')
    },
  })

  const downloadPdf = useMutation({
    mutationFn: async () => {
      const map = mapRef?.getMap()
      if (!map) throw new Error('Map not available')
      const returnTo = current
      const pages = [
        // Each stop is opened from where you started, so it never pushes over your forward history
        ...stops.map((stop) => ({ ...stop, visit: async () => { await store.go(returnTo); shared.open(stop) } })),
        ...ownLabeled.map((step) => ({ label: step.label ?? '', href: step.href, visit: () => store.go(step.index), visitFirst: true })),
      ]
      const { exportStepsPdf } = await import('./steps-pdf')
      const progress = toast.loading('Building PDF…')
      try {
        return await exportStepsPdf({
          map,
          pages,
          queryClient,
          origin: window.location.origin,
          getLegendData,
          onProgress: (done, total) => toast.loading(`Building PDF… page ${Math.min(done + 1, total)} of ${total}`, { id: progress }),
        })
      } finally {
        toast.dismiss(progress)
        await store.go(returnTo)
      }
    },
    onSuccess: (partialPages) => {
      if (partialPages === 0) toast.success('PDF downloaded')
      else toast.warning(`PDF downloaded; ${plural(partialPages, 'page')} printed before the map finished drawing`)
    },
    onError: (error) => {
      console.error('Could not build the PDF:', error)
      toast.error('Could not build the PDF. Please try again.')
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
                    <li key={`${i}-${stop.href}`} className='flex'>
                      <button type='button' onClick={() => openStop(stop)} className={ROW}>
                        <span className='w-4 shrink-0 text-right tabular-nums opacity-60'>{stopLetter(i)}</span>
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
                    <>
                      <button
                        type='button'
                        aria-current={step.index === current ? 'step' : undefined}
                        onClick={() => void store.go(step.index)}
                        className={cn(ROW, step.index === current && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')}
                      >
                        <span className='w-4 shrink-0 text-right tabular-nums opacity-60'>{step.index + 1}</span>
                        <span className='min-w-0 flex-1 truncate'>
                          {step.label ? <><span className='font-medium'>{step.label}</span> <span className='opacity-70'>· {step.summary}</span></> : step.summary}
                        </span>
                      </button>
                      <button
                        type='button'
                        title={step.label ? 'Rename step' : 'Label step'}
                        aria-label={`${step.label ? 'Rename' : 'Label'} step ${step.index + 1}`}
                        onClick={() => setEditing(step.index)}
                        className='flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      >
                        <Pencil size={12} aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ol>
            {sharing.length === 0 ? (
              <p className='mt-2 text-center text-xs text-muted-foreground'>Label steps to share them as a link or PDF</p>
            ) : (
              <>
                <div className='mt-2 flex gap-1.5'>
                  <button
                    type='button'
                    onClick={() => copyLink.mutate()}
                    disabled={copyLink.isPending}
                    className='flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
                  >
                    <Link size={12} aria-hidden />
                    Copy link
                  </button>
                  <button
                    type='button'
                    onClick={() => downloadPdf.mutate()}
                    disabled={downloadPdf.isPending}
                    className='flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50'
                  >
                    <FileDown size={12} aria-hidden />
                    {downloadPdf.isPending ? 'Building…' : 'PDF'}
                  </button>
                </div>
                <p className='mt-1 text-center text-xs text-muted-foreground'>{`Shares the ${sharingWhat}`}</p>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
