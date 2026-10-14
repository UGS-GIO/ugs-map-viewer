// The phone sheet's drag. The header takes a pointer drag; the content takes a touch drag once it
// moves past a slop. During a drag the height goes straight to the DOM, with no React render per
// frame; on release it hands back to the rendered height. Detent math from the ugs-warehouse
// viewer; the gesture guards from ugs-fleet-fuel-finder's drawer.
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { clampSize, contentTakesDrag, DETENTS, heightPct, settleDetent, type Detent } from './sheet-model'

// A header press that moves less than this is a tap.
const TAP_SLOP_PX = 4
// The content claims a touch only past this: below where iOS starts its own scroll, above a thumb's drift.
const CONTENT_SLOP_PX = 8
// A release more than this far below the press settles on the peek.
const PULL_DOWN_PX = CONTENT_SLOP_PX
// A touch this soon after the content scrolled lands on a fling still in motion.
const SCROLL_SETTLE_MS = 100
// A click this soon after a drag is the drag's own release. A timestamp, because a touch drag fires no click.
const CLICK_AFTER_DRAG_MS = 300

const TYPING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

type Drag = { y0: number; h0: number; height: number; y: number; t: number; speed: number }

// WebKit can report the text node under a finger as the target.
const elementOf = (t: EventTarget | null) => (t instanceof Element ? t : t instanceof Node ? t.parentElement : null)

// Nested scrollers count: a table scrolled down inside the sheet should scroll, not drag.
function scrolledDown(from: Element | null, root: HTMLElement) {
  for (let n = from; n && root.contains(n); n = n.parentElement) {
    if (n.scrollTop !== 0) return true
  }
  return false
}

// A touch-action: none element (a slider, a reorder grip) runs its own gesture.
function handlesOwnTouch(from: Element | null, root: HTMLElement) {
  for (let n = from; n && n !== root; n = n.parentElement) {
    if (getComputedStyle(n).touchAction === 'none') return true
  }
  return false
}

export function useSheetDrag(
  areaRef: RefObject<HTMLElement | null>,
  detent: Detent,
  onRelease: (d: Detent) => void,
  contentDragOff: boolean,
) {
  const sheetRef = useRef<HTMLElement | null>(null)
  const drag = useRef<Drag | null>(null)
  const dragEndedAt = useRef(-Infinity)
  // Ends the header gesture in progress, so a press whose release never arrived can't leave listeners behind.
  const cancelGesture = useRef<(() => void) | null>(null)

  useEffect(() => () => cancelGesture.current?.(), [])

  const heightOf = (d: Drag, y: number) => clampSize(d.h0 + d.y0 - y, d.height * 0.04, d.height * 0.96, d.h0)

  // Speed is measured from the press (t0), so the slop distance never reads as a flick.
  const begin = (y: number, t0: number) => {
    const height = areaRef.current?.clientHeight || window.innerHeight
    // The rendered height, not the detent's: the peek is held up by the header's min-height.
    const h0 = sheetRef.current?.offsetHeight || height * DETENTS[detent]
    drag.current = { y0: y, h0, height, y, t: t0, speed: 0 }
  }
  const move = (y: number) => {
    const d = drag.current
    if (!d) return
    const now = performance.now()
    const speed = ((d.y - y) / d.height / Math.max(now - d.t, 1)) * 1000
    Object.assign(d, { y, t: now, speed: 0.7 * speed + 0.3 * d.speed })
    const el = sheetRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.height = `${heightOf(d, y)}px`
  }
  // Writes the height here too: when the detent doesn't change, React has no new style to write.
  const settle = (to: Detent) => {
    const el = sheetRef.current
    if (el) Object.assign(el.style, { transition: '', height: heightPct(to) })
  }
  const end = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    dragEndedAt.current = performance.now()
    const next = settleDetent(heightOf(d, d.y) / d.height, d.speed, d.y - d.y0 > PULL_DOWN_PX)
    settle(next)
    onRelease(next)
  }
  const cancel = () => {
    if (!drag.current) return
    drag.current = null
    settle(detent)
  }

  // Listeners attached once read the latest render through this.
  const latest = useRef({ begin, move, end, cancel, detent, contentDragOff })
  useLayoutEffect(() => {
    latest.current = { begin, move, end, cancel, detent, contentDragOff }
  })

  // Capture starts only once the press moves, so a tap's click still lands on the grabber.
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.isPrimary === false || e.button !== 0) return
    const pressed = elementOf(e.target)?.closest('button, a')
    if (pressed && !pressed.hasAttribute('data-grabber')) return
    cancelGesture.current?.()
    const el = e.currentTarget
    const { pointerId, clientY: startY } = e
    const t0 = performance.now()
    let started = false
    const off = new AbortController()
    const finish = (ok: boolean) => {
      off.abort()
      cancelGesture.current = null
      if (started) (ok ? latest.current.end : latest.current.cancel)()
      if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId)
    }
    cancelGesture.current = () => finish(false)
    window.addEventListener('pointermove', (ev) => {
      if (!started) {
        if (Math.abs(ev.clientY - startY) < TAP_SLOP_PX) return
        started = true
        el.setPointerCapture?.(pointerId)
        latest.current.begin(startY, t0)
      }
      latest.current.move(ev.clientY)
    }, { signal: off.signal })
    window.addEventListener('pointerup', () => finish(true), { signal: off.signal })
    window.addEventListener('pointercancel', () => finish(false), { signal: off.signal })
    el.addEventListener('lostpointercapture', (ev) => {
      if (ev.target === el) finish(false)
    }, { signal: off.signal })
  }

  // Touch, not pointer: only a non-passive touchmove can stop the browser taking the swipe as a scroll.
  const contentRef = useCallback((el: HTMLElement | null) => {
    if (!el) return
    let x0 = 0
    let y0 = 0
    let t0 = 0
    let lastScrollAt = -Infinity
    let state: 'off' | 'pending' | 'dragging' = 'off'
    const off = new AbortController()
    const stop = (ok: boolean) => {
      if (state === 'dragging') (ok ? latest.current.end : latest.current.cancel)()
      state = 'off'
    }
    // Capture, since scroll doesn't bubble: a nested scroller's fling counts too.
    el.addEventListener('scroll', () => {
      lastScrollAt = performance.now()
    }, { capture: true, passive: true, signal: off.signal })
    el.addEventListener('touchstart', (e) => {
      stop(false)
      const target = elementOf(e.target)
      t0 = performance.now()
      const settled = t0 - lastScrollAt > SCROLL_SETTLE_MS
      const ok = e.touches.length === 1 && settled && !latest.current.contentDragOff
        && !target?.closest(TYPING) && !handlesOwnTouch(target, el)
      state = ok ? 'pending' : 'off'
      x0 = e.touches[0]?.clientX ?? 0
      y0 = e.touches[0]?.clientY ?? 0
    }, { passive: true, signal: off.signal })
    el.addEventListener('touchmove', (e) => {
      if (state === 'off') return
      if (e.touches.length > 1) return stop(false)
      const x = e.touches[0]?.clientX ?? x0
      const y = e.touches[0]?.clientY ?? y0
      if (state === 'pending') {
        const atTop = !scrolledDown(elementOf(e.target), el)
        // Claim a downward pull at the top at once, so iOS's rubber-band overscroll can't start first.
        if (e.cancelable && atTop && y - y0 > 0 && y - y0 >= Math.abs(x - x0)) e.preventDefault()
        if (Math.hypot(x - x0, y - y0) < CONTENT_SLOP_PX) return
        if (!e.cancelable || !contentTakesDrag(x - x0, y - y0, atTop, latest.current.detent)) {
          state = 'off'
          return
        }
        state = 'dragging'
        latest.current.begin(y0, t0)
      }
      e.preventDefault()
      latest.current.move(y)
    }, { passive: false, signal: off.signal })
    el.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) stop(true)
    }, { signal: off.signal })
    el.addEventListener('touchcancel', () => stop(false), { signal: off.signal })
    return () => {
      stop(false)
      off.abort()
    }
  }, [])

  // A keyboard click (detail 0) is never a drag's release.
  const wasDrag = (e: ReactMouseEvent) => e.detail > 0 && performance.now() - dragEndedAt.current < CLICK_AFTER_DRAG_MS

  return { sheetRef, onPointerDown, contentRef, wasDrag }
}
