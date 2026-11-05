import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stopLetter } from '@/lib/map/shared-stops'
import { usePresentation } from '@/hooks/use-presentation'

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp']
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable=false])'

/** Steps through shared stops over the map, like slides; arrow keys move and Escape leaves to explore. */
export function PresentationBar() {
  const { index, stops, go, exit } = usePresentation()
  const last = index === stops.length - 1

  // Latest values for the one key listener below
  const keys = useRef({ index, go, exit })
  useEffect(() => { keys.current = { index, go, exit } })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof Element && e.target.closest(EDITABLE)) return
      const { index, go, exit } = keys.current
      const step = NEXT_KEYS.includes(e.key) ? 1 : PREVIOUS_KEYS.includes(e.key) ? -1 : 0
      if (!step && e.key !== 'Escape') return
      // Ahead of the map, whose arrow keys would pan instead
      e.preventDefault()
      e.stopPropagation()
      if (step) go(index + step)
      else exit()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-4'>
      <div
        role='region'
        aria-label='Presentation'
        className='pointer-events-auto flex w-full max-w-xl items-center gap-1 rounded-lg border bg-background/95 p-2 text-foreground shadow-lg backdrop-blur'
      >
        <Button variant='ghost' size='icon' aria-label='Previous stop' disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft className='size-5' />
        </Button>
        <div className='min-w-0 flex-1 text-center' aria-live='polite'>
          <p className='truncate text-sm font-medium'>{stopLetter(index)}. {stops[index].label}</p>
          <p className='text-xs text-muted-foreground'>{index + 1} of {stops.length}</p>
        </div>
        <Button variant='ghost' size='icon' aria-label='Next stop' disabled={last} onClick={() => go(index + 1)}>
          <ChevronRight className='size-5' />
        </Button>
        {/* The way out, and the next thing to do once the last stop is shown */}
        <Button variant={last ? 'default' : 'outline'} size='sm' onClick={exit} title='Leave the presentation and use the map'>
          <Compass className='size-4' />
          Explore
        </Button>
      </div>
    </div>
  )
}
