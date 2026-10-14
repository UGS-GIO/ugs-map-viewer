import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { ChevronLeft, Ellipsis, Info, Layers, List, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PEEK, type Detent, type PhoneTab } from './sheet-model'

const TABS: { id: PhoneTab; label: string; Icon: LucideIcon }[] = [
  { id: 'layers', label: 'Layers', Icon: Layers },
  { id: 'results', label: 'Results', Icon: List },
  { id: 'info', label: 'Info', Icon: Info },
  { id: 'more', label: 'More', Icon: Ellipsis },
]

// Indexed by Detent. The peek is the header's height; the others are fractions of the map area.
const SNAP_POINTS = ['4.5rem', 0.55, 0.92]
const detentOf = (p: Drawer.Root.SnapPoint | null) => {
  const i = SNAP_POINTS.indexOf(p ?? '')
  return i === 1 || i === 2 ? i : PEEK
}

const NEXT: Record<Detent, Detent> = { 0: 1, 1: 2, 2: 0 }
const UP: Record<Detent, Detent> = { 0: 1, 1: 2, 2: 2 }
const DOWN: Record<Detent, Detent> = { 0: 0, 1: 0, 2: 1 }

// The grabber says what a tap does next; with the arrow keys it is the non-drag path WCAG 2.5.7 asks for.
const GRABBER_LABEL = ['Expand panel', 'Expand panel to full height', 'Collapse panel']

// No tap highlight, no long-press callout: the native-app feel iOS users expect.
const TOUCH_CHROME = 'select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]'

export interface PhoneSheetProps {
  map: ReactNode
  detent: Detent
  activeTab: PhoneTab
  /** What the sheet shows; focus moves to the title when it changes. */
  panelKey: string
  title: string
  /** One line beside the title at the peek, such as "2 results". */
  summary?: string
  back?: { label: string; onClick: () => void }
  onSelectTab: (tab: PhoneTab) => void
  onSetDetent: (detent: Detent) => void
  children: ReactNode
}

/** Full map, one always-open non-modal drawer over it, and the tab bar that picks what it holds. */
export function PhoneSheet({ map, detent, activeTab, panelKey, title, summary, back, onSelectTab, onSetDetent, children }: PhoneSheetProps) {
  const areaRef = useRef<HTMLDivElement | null>(null)
  const collapsed = detent === PEEK

  // A newly opened panel puts focus on its title so screen readers announce it. Page load, and a
  // title filling in after loading, leave focus alone.
  const shown = useRef<string | null>(null)
  const focusNewPanel = useCallback((el: HTMLHeadingElement | null) => {
    if (el && shown.current !== null && shown.current !== panelKey && !collapsed) el.focus({ preventScroll: true })
    if (el) shown.current = panelKey
  }, [panelKey, collapsed])

  const arrows = (e: KeyboardEvent) => {
    const to = e.key === 'ArrowUp' ? UP : e.key === 'ArrowDown' ? DOWN : null
    if (!to) return
    e.preventDefault()
    onSetDetent(to[detent])
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div ref={areaRef} className='relative min-h-0 flex-1'>
        <div className='phone-map absolute inset-0' data-tour='phone-map'>
          {map}
        </div>
      </div>
      {/* After the area, not inside it: the portal reads areaRef once the area has committed. */}
      <Drawer.Root
        open
        modal={false}
        disablePointerDismissal
        snapPoints={SNAP_POINTS}
        snapPoint={SNAP_POINTS[detent]}
        snapToSequentialPoints
        // The sheet never closes: a swipe past the peek or Escape drops it to the peek.
        onSnapPointChange={(p, details) => {
          if (p === null) details.cancel()
          onSetDetent(detentOf(p))
        }}
        onOpenChange={(open, details) => {
          if (open) return
          details.cancel()
          onSetDetent(PEEK)
        }}
      >
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Portal container={areaRef}>
            <Drawer.Viewport className='pointer-events-none absolute inset-0 z-20 flex items-end'>
              <Drawer.Popup
                initialFocus={false}
                finalFocus={false}
                className={cn(
                  'pointer-events-auto relative flex h-[92%] w-full flex-col rounded-t-2xl border-t bg-background text-foreground shadow-[0_-4px_16px_rgba(0,0,0,0.15)] outline-none',
                  '[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]',
                  'transition-transform duration-300 ease-out data-swiping:duration-0 motion-reduce:transition-none',
                )}
              >
                <div data-tour='phone-sheet-header' className={cn('relative shrink-0 cursor-grab touch-none', TOUCH_CHROME)}>
                  <button
                    type='button'
                    aria-label={GRABBER_LABEL[detent]}
                    aria-expanded={!collapsed}
                    onClick={() => onSetDetent(NEXT[detent])}
                    onKeyDown={arrows}
                    className='flex h-6 w-full items-end justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                  >
                    <span aria-hidden='true' className='h-1.5 w-10 rounded-full bg-muted-foreground/40' />
                  </button>
                  <div className='flex min-h-11 items-center gap-2 px-4 pb-1'>
                    {back && (
                      <button type='button' onClick={back.onClick} className='-ml-2 flex h-11 shrink-0 items-center px-1 text-base text-primary'>
                        <ChevronLeft className='h-5 w-5' aria-hidden='true' />
                        {back.label}
                      </button>
                    )}
                    <Drawer.Title
                      key={panelKey}
                      ref={focusNewPanel}
                      tabIndex={-1}
                      className='min-w-0 truncate text-lg font-semibold outline-none focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                    >
                      {title}
                    </Drawer.Title>
                    {collapsed && summary && <span className='min-w-0 truncate text-sm text-muted-foreground'>{summary}</span>}
                  </div>
                </div>
                <Drawer.Content inert={collapsed} className='phone-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto px-4 pb-4'>
                  {children}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
      <nav aria-label='Map views' data-tour='phone-tabs' className={cn('z-30 flex shrink-0 touch-manipulation border-t bg-background pb-[env(safe-area-inset-bottom)]', TOUCH_CHROME)}>
        {TABS.map(({ id, label, Icon }) => {
          const showing = id === activeTab && !collapsed
          return (
            <button
              key={id}
              type='button'
              data-tour={`phone-tab-${id}`}
              onClick={() => onSelectTab(id)}
              aria-current={showing ? 'page' : undefined}
              aria-expanded={showing}
              className={cn(
                'flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium leading-none',
                showing ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon size={22} strokeWidth={showing ? 2.25 : 1.75} aria-hidden='true' />
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
