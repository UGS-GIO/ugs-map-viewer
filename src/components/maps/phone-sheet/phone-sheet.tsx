import { useCallback, useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ChevronLeft, Ellipsis, Info, Layers, List, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DETENTS, FULL, PEEK, heightPct, type Detent, type PhoneTab } from './sheet-model'
import { useSheetDrag } from './use-sheet-drag'
import { useKeyboardViewport } from './use-keyboard-viewport'

const TABS: { id: PhoneTab; label: string; Icon: LucideIcon }[] = [
  { id: 'layers', label: 'Layers', Icon: Layers },
  { id: 'results', label: 'Results', Icon: List },
  { id: 'info', label: 'Info', Icon: Info },
  { id: 'more', label: 'More', Icon: Ellipsis },
]

// The grabber says what a tap does next; with the arrow keys it is the non-drag path WCAG 2.5.7 asks for.
const GRABBER_LABEL = ['Expand panel', 'Expand panel to full height', 'Collapse panel']

// React's stopPropagation also stops the native event at the root, so a gesture in the sheet never
// reaches MapLibre's window and document listeners.
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

// No tap highlight, no long-press callout, no double-tap zoom: the native-app feel iOS users expect.
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
  onClose?: () => void
  closeLabel?: string
  onSelectTab: (tab: PhoneTab) => void
  onSetDetent: (detent: Detent) => void
  children: ReactNode
}

/** Full map, one draggable sheet over it, and the tab bar that picks what the sheet holds. */
export function PhoneSheet({ map, detent, activeTab, panelKey, title, summary, back, onClose, closeLabel = 'Close', onSelectTab, onSetDetent, children }: PhoneSheetProps) {
  const areaRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const grabberRef = useRef<HTMLButtonElement | null>(null)
  const contentEl = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const contentId = useId()
  const keyboard = useKeyboardViewport()
  const { sheetRef, onPointerDown, contentRef, wasDrag } = useSheetDrag(areaRef, detent, onSetDetent, keyboard !== null)
  const collapsed = detent === PEEK

  const setContent = useCallback((el: HTMLDivElement | null) => {
    contentEl.current = el
    return contentRef(el)
  }, [contentRef])

  // A newly opened panel puts focus on its title (not a field, so no keyboard opens) so screen
  // readers announce it. Page load, and a title filling in after loading, leave focus alone.
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (shown.current !== null && shown.current !== panelKey && !collapsed) titleRef.current?.focus({ preventScroll: true })
    shown.current = panelKey
  }, [panelKey, collapsed])

  // At the peek the content is inert, so focus inside it moves to the grabber instead of the page.
  useEffect(() => {
    if (collapsed && contentEl.current?.contains(document.activeElement)) grabberRef.current?.focus({ preventScroll: true })
  }, [collapsed])

  // Once the iOS keyboard has finished opening, keep the focused field in view.
  useEffect(() => {
    const el = contentEl.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocusIn = (e: FocusEvent) => {
      const field = e.target instanceof Element ? e.target.closest(TYPING) : null
      if (!field) return
      clearTimeout(timer)
      timer = setTimeout(() => field.scrollIntoView?.({ block: 'nearest' }), 300)
    }
    el.addEventListener('focusin', onFocusIn)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  // While the keyboard is up the sheet is pinned to the visible area, so the header doesn't move it.
  const step = (e: MouseEvent) => {
    if (!keyboard && !wasDrag(e)) onSetDetent(((detent + 1) % DETENTS.length) as Detent)
  }
  const arrows = (e: KeyboardEvent) => {
    const by = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
    if (!by || keyboard) return
    e.preventDefault()
    onSetDetent(Math.min(Math.max(detent + by, PEEK), FULL) as Detent)
  }
  // React bubbles events out of portals, so a popover opened from the sheet would reach here too.
  const escape = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || collapsed || e.defaultPrevented) return
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return
    e.stopPropagation()
    onSetDetent(PEEK)
  }
  // The header's empty space is a tap target too; its buttons handle their own clicks.
  const tapHeader = (e: MouseEvent) => {
    if (!(e.target instanceof Element && e.target.closest('button, a'))) step(e)
  }
  const ignoreClickAfterDrag = (e: MouseEvent) => {
    if (!wasDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
  }
  const close = () => {
    onClose?.()
    grabberRef.current?.focus({ preventScroll: true })
  }

  // While the iOS keyboard is up the sheet fills the visible area above it; iOS doesn't shrink the
  // layout viewport, so a sheet sized to the page would sit under the keyboard.
  const sheetStyle: CSSProperties = keyboard
    ? { position: 'fixed', left: 0, right: 0, top: keyboard.top, height: keyboard.height, bottom: 'auto' }
    : { height: heightPct(detent) }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div ref={areaRef} className='relative min-h-0 flex-1'>
        <div className='phone-map absolute inset-0' data-tour='phone-map'>
          {map}
        </div>
        <section
          ref={sheetRef}
          aria-labelledby={titleId}
          style={sheetStyle}
          onTouchStart={stop}
          onTouchMove={stop}
          onWheel={stop}
          onKeyDown={escape}
          className={cn(
            'absolute inset-x-0 bottom-0 flex min-h-[4.5rem] flex-col overflow-hidden rounded-t-2xl border-t bg-background text-foreground shadow-[0_-4px_16px_rgba(0,0,0,0.15)]',
            // Above the tab bar (z-30) while pinned over the keyboard.
            keyboard ? 'z-40' : 'z-20 transition-[height] duration-300 ease-out motion-reduce:transition-none',
          )}
        >
          <div
            data-tour='phone-sheet-header'
            onPointerDown={keyboard ? undefined : onPointerDown}
            onClick={tapHeader}
            onClickCapture={ignoreClickAfterDrag}
            onContextMenu={(e) => e.preventDefault()}
            className={cn('relative shrink-0 cursor-grab touch-none', TOUCH_CHROME)}
          >
            <button
              ref={grabberRef}
              type='button'
              data-grabber
              aria-label={GRABBER_LABEL[detent]}
              aria-controls={contentId}
              aria-expanded={!collapsed}
              onClick={step}
              onKeyDown={arrows}
              className='flex h-6 w-full items-end justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            >
              <span aria-hidden='true' className='h-1.5 w-10 rounded-full bg-muted-foreground/40' />
            </button>
            <div className='flex min-h-11 items-center gap-2 pb-1 pl-4 pr-14'>
              {back && (
                <button type='button' onClick={back.onClick} className='-ml-2 flex h-11 shrink-0 items-center px-1 text-base text-primary'>
                  <ChevronLeft className='h-5 w-5' aria-hidden='true' />
                  {back.label}
                </button>
              )}
              <h2
                ref={titleRef}
                id={titleId}
                tabIndex={-1}
                className='min-w-0 truncate text-lg font-semibold outline-none focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
              >
                {title}
              </h2>
              {collapsed && summary && <span className='min-w-0 truncate text-sm text-muted-foreground'>{summary}</span>}
            </div>
            {onClose && (
              <button
                type='button'
                onClick={close}
                aria-label={closeLabel}
                className='absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground'
              >
                <X className='h-5 w-5' aria-hidden='true' />
              </button>
            )}
          </div>
          <div
            ref={setContent}
            id={contentId}
            {...({ inert: collapsed } as object)}
            onClickCapture={ignoreClickAfterDrag}
            className='phone-sheet-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4'
          >
            {children}
          </div>
        </section>
      </div>
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
              aria-controls={contentId}
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
