import { useEffect, type RefObject } from 'react'

const SCROLLERS = new Set(['auto', 'scroll'])

const isTextControl = (el: HTMLElement) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable

/**
 * Keeps every non-scrolling box inside `ref` at scroll offset 0.
 *
 * Browsers still scroll `overflow: hidden` boxes to reveal a focused element or answer
 * scrollIntoView, so a hidden control whose containing block sits outside its scroller can slide
 * a whole layout region off-screen. Any box that isn't a scroller (overflow auto/scroll) and gets
 * scrolled is put back, and the offender is logged so it can be fixed at the source.
 */
export function useLockLayoutScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onScroll = (event: Event) => {
      const el = event.target
      if (!(el instanceof HTMLElement) || isTextControl(el)) return
      if (el.scrollTop === 0 && el.scrollLeft === 0) return
      const style = getComputedStyle(el)
      const resetY = el.scrollTop !== 0 && !SCROLLERS.has(style.overflowY)
      const resetX = el.scrollLeft !== 0 && !SCROLLERS.has(style.overflowX)
      if (!resetY && !resetX) return

      console.warn('A layout box that should not scroll was scrolled; resetting it.', {
        box: el,
        focused: document.activeElement,
      })
      if (resetY) el.scrollTop = 0
      if (resetX) el.scrollLeft = 0
    }

    // scroll doesn't bubble; capture sees it for every descendant.
    root.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => root.removeEventListener('scroll', onScroll, { capture: true })
  }, [ref])
}
