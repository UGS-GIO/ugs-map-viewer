// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useLockLayoutScroll } from '../use-lock-layout-scroll'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mounted: (() => void)[] = []
afterEach(() => {
  mounted.splice(0).forEach((unmount) => unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function mount() {
  function Shell() {
    const ref = useRef<HTMLDivElement>(null)
    useLockLayoutScroll(ref)
    return (
      <div ref={ref} data-testid='shell'>
        <div data-testid='hidden' style={{ overflow: 'hidden' }} />
        <div data-testid='scroller' style={{ overflowY: 'auto' }} />
        <input data-testid='input' />
      </div>
    )
  }
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  act(() => root.render(<Shell />))
  mounted.push(() => act(() => root.unmount()))
  return (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
    if (!el) throw new Error(`missing test element: ${id}`)
    return el
  }
}

// jsdom has no layout, so give the element a writable scroll offset and fire the event by hand.
function scroll(el: HTMLElement, top: number, left = 0) {
  Object.defineProperty(el, 'scrollTop', { value: top, writable: true, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: left, writable: true, configurable: true })
  el.dispatchEvent(new Event('scroll'))
}

describe('useLockLayoutScroll', () => {
  it('puts a scrolled overflow-hidden box back at 0 and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const get = mount()
    scroll(get('hidden'), 889, 12)
    expect(get('hidden').scrollTop).toBe(0)
    expect(get('hidden').scrollLeft).toBe(0)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('leaves real scrollers and text inputs alone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const get = mount()
    scroll(get('scroller'), 300)
    scroll(get('input'), 0, 40)
    expect(get('scroller').scrollTop).toBe(300)
    expect(get('input').scrollLeft).toBe(40)
    expect(warn).not.toHaveBeenCalled()
  })

  it('re-reads overflow when an element changes class', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const get = mount()
    const box = get('scroller')
    scroll(box, 100)
    expect(box.scrollTop).toBe(100)
    box.className = 'now-hidden'
    box.style.overflowY = 'hidden'
    scroll(box, 100)
    expect(box.scrollTop).toBe(0)
  })

  it('stops listening on unmount', () => {
    const get = mount()
    const hidden = get('hidden')
    mounted.splice(0).forEach((unmount) => unmount())
    scroll(hidden, 50)
    expect(hidden.scrollTop).toBe(50)
  })
})
