import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { ChevronLeft, Ellipsis, Info, Layers, List, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DETENTS, FULL, HALF, PEEK, SHEET_FRACTION, type Detent, type PhoneTab } from './sheet-model'

const TABS: { id: PhoneTab; label: string; Icon: LucideIcon }[] = [
  { id: 'layers', label: 'Layers', Icon: Layers },
  { id: 'results', label: 'Results', Icon: List },
  { id: 'info', label: 'Info', Icon: Info },
  { id: 'more', label: 'More', Icon: Ellipsis },
]

// The peek is the header's height; the others are fractions of the map area. index.css keeps the
// map's bottom controls above these.
const SNAP: Record<Detent, Drawer.Root.SnapPoint> = { peek: '4.5rem', ...SHEET_FRACTION }
const SNAP_POINTS = DETENTS.map((d) => SNAP[d])
// A null snap point (a cancelled swipe-off) is the peek.
const detentOf = (p: Drawer.Root.SnapPoint | null) => DETENTS.find((d) => SNAP[d] === p) ?? PEEK

const NEXT: Record<Detent, Detent> = { peek: HALF, half: FULL, full: PEEK }
const UP: Record<Detent, Detent> = { peek: HALF, half: FULL, full: FULL }
const DOWN: Record<Detent, Detent> = { peek: PEEK, half: PEEK, full: HALF }

// The grabber says what a tap does next; with the arrow keys it is the non-drag path WCAG 2.5.7 asks for.
const GRABBER_LABEL: Record<Detent, string> = { peek: 'Expand panel', half: 'Expand panel to full height', full: 'Collapse panel' }

// No tap highlight, no long-press callout: the native-app feel iOS users expect.
const TOUCH_CHROME = 'select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]'

export interface PhoneSheetProps {
  /** The map area the sheet slides over. Rendered before this component so the ref is set. */
  container: RefObject<HTMLElement | null>
  detent: Detent
  activeTab: PhoneTab
  /** What the sheet shows; focus moves to the title when it changes. */
  panelKey: string
  title: string
  /** One line beside the title at the peek, such as "2 results". */
  summary?: string
  /** A control at the end of the header row while the sheet is raised, such as Cards | Table. */
  headerAction?: ReactNode
  back?: { label: string; onClick: () => void }
  onSelectTab: (tab: PhoneTab) => void
  onSetDetent: (detent: Detent) => void
  children: ReactNode
}

/** One always-open non-modal drawer over the map, and the tab bar that picks what it holds. */
export function PhoneSheet({ container, detent, activeTab, panelKey, title, summary, headerAction, back, onSelectTab, onSetDetent, children }: PhoneSheetProps) {
  const collapsed = detent === PEEK
  const contentId = useId()

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
    <>
      <Drawer.Root
        open
        modal={false}
        disablePointerDismissal
        snapPoints={SNAP_POINTS}
        snapPoint={SNAP[detent]}
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
          <Drawer.Portal container={container}>
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
                    aria-controls={contentId}
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
                    {/* Ignored by the drag, so a tap on it is never a swipe. */}
                    {!collapsed && headerAction && <div data-base-ui-swipe-ignore className='ml-auto shrink-0'>{headerAction}</div>}
                  </div>
                </div>
                {/* Content scrolls only at full height. Below it a drag anywhere moves the whole sheet,
                    as in Apple Maps, instead of scrolling the list under a sheet that stays put. */}
                <Drawer.Content
                  id={contentId}
                  inert={collapsed}
                  className={cn(
                    'phone-sheet-content min-h-0 flex-1 overscroll-contain px-4 pb-4',
                    detent === FULL ? 'overflow-y-auto touch-auto' : 'overflow-hidden touch-none',
                  )}
                >
                  {children}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Root>
      <nav aria-label='Map views' data-tour='phone-tabs' className={cn('z-30 shrink-0 touch-manipulation border-t bg-background pb-[env(safe-area-inset-bottom)]', TOUCH_CHROME)}>
        {/* The showing tab is pressed; pressing it again unpresses it, which drops the sheet to the peek. */}
        <ToggleGroup
          value={collapsed ? [] : [activeTab]}
          onValueChange={([next]) => onSelectTab(next ?? activeTab)}
          className='flex'
        >
          {TABS.map(({ id, label, Icon }) => (
            <Toggle
              key={id}
              value={id}
              data-tour={`phone-tab-${id}`}
              className='group flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium leading-none text-muted-foreground data-[pressed]:text-primary'
            >
              <Icon size={22} aria-hidden='true' className='stroke-[1.75] group-data-[pressed]:stroke-[2.25]' />
              {label}
            </Toggle>
          ))}
        </ToggleGroup>
      </nav>
    </>
  )
}
