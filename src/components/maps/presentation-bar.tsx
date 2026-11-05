import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stopLetter } from '@/lib/map/shared-stops'
import { usePresentation } from '@/hooks/use-presentation'
import { usePresentationKeys } from '@/hooks/use-presentation-keys'

/** Renders nothing; listens for the presentation's keys where there's no bar, as on phones. */
export function PresentationKeys() {
  usePresentationKeys()
  return null
}

/** Previous and next around `children`, then the way out, which leads once the last stop shows. */
export function PresentationNav({ children }: { children?: ReactNode }) {
  const { index, stops, go, exit } = usePresentation()
  const last = index === stops.length - 1
  return (
    <>
      <Button variant='ghost' size='icon' aria-label='Previous stop' disabled={index === 0} onClick={() => go(index - 1)}>
        <ChevronLeft className='size-5' />
      </Button>
      {children}
      <Button variant='ghost' size='icon' aria-label='Next stop' disabled={last} onClick={() => go(index + 1)}>
        <ChevronRight className='size-5' />
      </Button>
      <Button variant={last ? 'default' : 'outline'} size='sm' onClick={exit} title='Leave the presentation and use the map'>
        <Compass className='size-4' />
        Explore
      </Button>
    </>
  )
}

/** Steps through shared stops over the map, like slides. Phones show them in the sheet instead. */
export function PresentationBar() {
  const { index, stops } = usePresentation()
  usePresentationKeys()

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-4'>
      <div
        role='region'
        aria-label='Presentation'
        aria-live='polite'
        className='pointer-events-auto w-full max-w-2xl rounded-lg border bg-background/95 p-2 text-foreground shadow-lg backdrop-blur'
      >
        <div className='flex items-center gap-1'>
          <PresentationNav>
            <div className='min-w-0 flex-1 text-center'>
              <p className='line-clamp-2 text-sm font-medium'>{stopLetter(index)}. {stops[index].label}</p>
              <p className='text-xs text-muted-foreground'>{index + 1} of {stops.length}</p>
            </div>
          </PresentationNav>
        </div>
        {stops[index].note && (
          <p className='max-h-24 overflow-y-auto whitespace-pre-line border-t px-2 pt-1.5 text-sm text-muted-foreground'>{stops[index].note}</p>
        )}
      </div>
    </div>
  )
}
