import { memo, useRef, useState, useSyncExternalStore } from 'react'
import { Popover } from '@base-ui/react/popover'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMap } from 'react-map-gl/maplibre'
import { strToU8 } from 'fflate'
import { FileDown, FolderOpen, History, Link, Pencil, Presentation, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MapStep, MapSteps } from '@/lib/map/map-steps'
import { buildStopsLink, fitsInLink, stopLetter, stopsFromFile, stopsToFile, STOPS_FILE_NAME, toStopHref, type SharedStop, type SharedStops } from '@/lib/map/shared-stops'
import { downloadBytes } from '@/lib/download-utils'
import type { GetLegendData } from './export-control'
import { usePresentation } from '@/hooks/use-presentation'
import { openStop, presentStops } from '@/lib/map/app-history'

const ROW = 'flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent hover:text-accent-foreground'
const CURRENT = 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
const PDF_MUTATION_KEY = ['steps-pdf']
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const FIELD = 'min-w-0 rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs text-foreground'

/** A step's label, plus a note to show under it when presenting. Save, Enter in the label or Ctrl+Enter saves. */
function StepLabelEditor({ step, onDone }: { step: MapStep; onDone: (edit?: { label: string; note: string }) => void }) {
  // Enter or Escape ends the edit; the blur that follows must not end it again with the typed value
  const ended = useRef(false)
  const label = useRef<HTMLInputElement>(null)
  const note = useRef<HTMLTextAreaElement>(null)
  const end = (save: boolean) => {
    if (ended.current) return
    ended.current = true
    onDone(save ? { label: label.current?.value ?? '', note: note.current?.value ?? '' } : undefined)
  }
  return (
    <div
      className='flex min-w-0 flex-1 flex-col gap-1 py-0.5'
      onKeyDown={(e) => {
        // Enter in the note is a new line; phones have no Shift to ask for one
        if (e.key === 'Enter' && (e.target === label.current || e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          end(true)
        }
        if (e.key === 'Escape') {
          // Cancel the edit without closing the popover
          e.stopPropagation()
          end(false)
        }
      }}
      // Moving between the two fields isn't leaving the edit
      onBlur={(e) => { if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) end(true) }}
    >
      <input ref={label} autoFocus defaultValue={step.label ?? ''} placeholder={step.summary} aria-label={`Label for step ${step.index + 1}`} className={FIELD} />
      <textarea
        ref={note}
        rows={2}
        defaultValue={step.note ?? ''}
        placeholder='Note to show when presenting (optional)'
        aria-label={`Note for step ${step.index + 1}`}
        className={cn(FIELD, 'resize-y')}
      />
      {/* Pointer down would blur the fields first, and the blur saves; Cancel must get there before it */}
      <div className='flex justify-end gap-1' onPointerDown={(e) => e.preventDefault()}>
        <button type='button' onClick={() => end(false)} className='rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground'>
          Cancel
        </button>
        <button type='button' onClick={() => end(true)} className='rounded-sm bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90'>
          Save
        </button>
      </div>
    </div>
  )
}

/**
 * One step in the list. Memoized: every map move publishes new steps, and a long history re-rendering
 * every row each time froze the map for seconds. Unchanged steps keep their object, so only changed rows render.
 */
const StepRow = memo(function StepRow({ step, current, editing, store, setEditing }: {
  step: MapStep
  current: boolean
  editing: boolean
  store: MapSteps
  setEditing: (index: number | undefined) => void
}) {
  return (
    <li className='flex items-center gap-1'>
      {editing ? (
        <StepLabelEditor
          step={step}
          onDone={(edit) => {
            if (edit) store.setLabel(step.index, edit.label, edit.note)
            setEditing(undefined)
          }}
        />
      ) : (
        <>
          <button
            type='button'
            aria-current={current ? 'step' : undefined}
            onClick={() => void store.go(step.index)}
            className={cn(ROW, current && CURRENT)}
          >
            <span className='w-4 shrink-0 text-right tabular-nums opacity-60'>{step.index + 1}</span>
            <span className='min-w-0 flex-1 truncate'>
              {step.label ? <><span className='font-medium'>{step.label}</span> <span className='opacity-70'>· {step.summary}</span></> : step.summary}
            </span>
          </button>
          <button
            type='button'
            title={step.label ? 'Edit label and note' : 'Label step'}
            aria-label={`${step.label ? 'Rename' : 'Label'} step ${step.index + 1}`}
            onClick={() => setEditing(step.index)}
            className='flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          >
            <Pencil size={12} aria-hidden />
          </button>
        </>
      )}
    </li>
  )
})

/** Jump to any step, label the ones that matter, and share them as a link or PDF. */
export function MapStepsPopover({ steps: store, shared, getLegendData }: { steps: MapSteps; shared: SharedStops; getLegendData?: GetLegendData }) {
  const { steps, current } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  // A step opened from a stop carries its label, so that's the stop you're on
  const currentLabel = steps.find((step) => step.index === current)?.label
  const { stops, unseen } = useSyncExternalStore(shared.subscribe, shared.getSnapshot)
  const [editing, setEditing] = useState<number>()
  const [open, setOpen] = useState(false)
  const { current: mapRef } = useMap()
  const queryClient = useQueryClient()
  const { presenting } = usePresentation()
  // A shared link presents its stops first; the list opens once the presentation is left
  const isOpen = open || (unseen && !presenting)

  // Shared stops plus your own labeled steps; a visited stop carries its stop's label, so it isn't counted twice
  const stopLabels = new Set(stops.map((stop) => stop.label))
  const ownLabeled = steps.filter((step) => step.label && !stopLabels.has(step.label))
  const sharing: SharedStop[] = [...stops, ...ownLabeled.map((step) => ({ label: step.label ?? '', href: toStopHref(step.href), note: step.note }))]
  const sharingWhat = stops.length > 0 ? plural(sharing.length, 'stop') : plural(sharing.length, 'labeled step')

  // Every map move re-renders this; only gzip the link while the list is showing it
  const link = isOpen && sharing.length > 0 ? buildStopsLink(window.location.origin, sharing) : ''
  const asLink = fitsInLink(link)

  const copyLink = useMutation({
    mutationFn: async () => {
      if (asLink) return navigator.clipboard.writeText(link)
      downloadBytes(strToU8(stopsToFile(sharing)), STOPS_FILE_NAME, 'application/json')
    },
    onSuccess: () => {
      if (asLink) toast.success(`Link to ${sharingWhat} copied`)
      else toast.success('Too long for a link; saved as a file you can send. Open it from Map history.')
    },
    onError: (error) => {
      console.error('Could not share the stops:', error)
      toast.error(asLink ? 'Could not copy the link. Please try again.' : 'Could not save the file. Please try again.')
    },
  })

  const openFile = useMutation({
    mutationFn: async (file: File) => stopsFromFile(await file.text()),
    onSuccess: (opened) => {
      setOpen(false)
      presentStops(opened, shared, store)
    },
    onError: (error) => {
      console.error('Could not open the map stops file:', error)
      toast.error('That file isn\'t a map stops file saved from Map history.')
    },
  })

  const downloadPdf = useMutation({
    mutationKey: PDF_MUTATION_KEY,
    mutationFn: async () => {
      const map = mapRef?.getMap()
      if (!map) throw new Error('Map not available')
      const returnTo = current
      // Stops open from the newest step, so the push drops no step you made, only the last stop's
      const newest = steps[steps.length - 1]?.index ?? current
      const pages = [
        ...stops.map((stop) => ({ ...stop, visit: async () => { await store.go(newest); shared.open(stop) } })),
        ...ownLabeled.map((step) => ({ label: step.label ?? '', note: step.note, href: step.href, visit: () => store.go(step.index), visitFirst: true })),
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
          mutationKey: PDF_MUTATION_KEY,
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

  return (
    <Popover.Root
      open={isOpen}
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
              <label
                title='Open a saved presentation file'
                className='ml-auto mr-1.5 flex cursor-pointer items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground hover:text-foreground focus-within:ring-2 focus-within:ring-ring'
              >
                <FolderOpen size={12} aria-hidden />
                Open
                <input
                  type='file'
                  accept='.json,application/json'
                  className='sr-only'
                  disabled={openFile.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    // Clear so picking the same file again still fires
                    e.target.value = ''
                    if (file) openFile.mutate(file)
                  }}
                />
              </label>
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
                      <button
                        type='button'
                        onClick={() => openStop(stop, undefined, shared, store)}
                        aria-current={stop.label === currentLabel ? 'step' : undefined}
                        className={cn(ROW, stop.label === currentLabel && CURRENT)}
                      >
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
                <StepRow key={step.index} step={step} current={step.index === current} editing={editing === step.index} store={store} setEditing={setEditing} />
              ))}
            </ol>
            {sharing.length === 0 ? (
              <p className='mt-2 text-center text-xs text-muted-foreground'>Label steps to present or share them</p>
            ) : (
              <>
                <div className='mt-2 flex gap-1.5'>
                  <button
                    type='button'
                    onClick={() => {
                      setOpen(false)
                      presentStops(sharing, shared, store)
                    }}
                    className='flex flex-1 items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground'
                  >
                    <Presentation size={12} aria-hidden />
                    Present
                  </button>
                  <button
                    type='button'
                    onClick={() => copyLink.mutate()}
                    disabled={copyLink.isPending}
                    className='flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50'
                  >
                    {asLink ? <Link size={12} aria-hidden /> : <Save size={12} aria-hidden />}
                    {asLink ? 'Copy link' : 'Save file'}
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
