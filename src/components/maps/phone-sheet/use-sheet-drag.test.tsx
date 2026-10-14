// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { useSheetDrag } from './use-sheet-drag'
import { HALF, FULL, PEEK, type Detent } from './sheet-model'
import { act, render } from './test-utils'

const AREA = 1000
let now = 0

function Harness({ detent, onRelease, contentDragOff = false, onWasDrag }: {
  detent: Detent
  onRelease: (d: Detent) => void
  contentDragOff?: boolean
  onWasDrag?: (v: boolean) => void
}) {
  const area = useRef<HTMLDivElement | null>(null)
  const { sheetRef, onPointerDown, contentRef, wasDrag } = useSheetDrag(area, detent, onRelease, contentDragOff)
  return (
    <div ref={area} data-testid="area">
      <section ref={sheetRef} data-testid="sheet">
        <div data-testid="header" onPointerDown={onPointerDown}>
          <button type="button" data-grabber data-testid="grabber">grab</button>
          <button type="button" data-testid="close">close</button>
        </div>
        <div ref={contentRef} data-testid="content" onClickCapture={(e) => onWasDrag?.(wasDrag(e))}>
          <input data-testid="field" />
          <p data-testid="text">text</p>
          <div data-testid="grip">grip</div>
        </div>
      </section>
    </div>
  )
}

const get = (c: HTMLElement, id: string) => c.querySelector(`[data-testid="${id}"]`) as HTMLElement

function pointer(target: EventTarget, type: string, y: number) {
  const Ctor = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent
  const e = new Ctor(type, { bubbles: true, cancelable: true, clientY: y, button: 0 })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  Object.defineProperty(e, 'isPrimary', { value: true })
  act(() => {
    target.dispatchEvent(e)
  })
}

function touch(el: Element, type: string, points: { x: number; y: number }[], cancelable = true) {
  const e = new Event(type, { bubbles: true, cancelable })
  Object.defineProperty(e, 'touches', { value: points.map((p) => ({ clientX: p.x, clientY: p.y })) })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

// Moves `ms` of fake time between events, so speeds are deterministic.
const tick = (ms: number) => {
  now += ms
}
const setHeight = (el: HTMLElement, px: number) => Object.defineProperty(el, 'offsetHeight', { configurable: true, value: px })

beforeEach(() => {
  now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => AREA })
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('header drag', () => {
  it('settles a slow drag on the nearest height', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={PEEK} onRelease={onRelease} />)
    const sheet = get(container, 'sheet')
    setHeight(sheet, 60)
    pointer(get(container, 'grabber'), 'pointerdown', 900)
    for (const y of [880, 820, 760, 700, 640, 600]) {
      tick(200)
      pointer(window, 'pointermove', y)
    }
    expect(sheet.style.height).toBe('360px')
    pointer(window, 'pointerup', 600)
    expect(onRelease).toHaveBeenCalledWith(HALF)
    expect(sheet.style.height).toBe('55%')
  })

  it('carries a flick one height further', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    setHeight(get(container, 'sheet'), 550)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    tick(16)
    pointer(window, 'pointermove', 420)
    tick(16)
    pointer(window, 'pointermove', 390)
    pointer(window, 'pointerup', 390)
    expect(onRelease).toHaveBeenCalledWith(FULL)
  })

  it('does not read the slop distance as a flick', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    setHeight(get(container, 'sheet'), 550)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    tick(400)
    pointer(window, 'pointermove', 444)
    tick(10)
    pointer(window, 'pointerup', 444)
    expect(onRelease).toHaveBeenCalledWith(HALF)
  })

  it('treats a press that moves under 4px as a tap', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    pointer(window, 'pointermove', 447)
    pointer(window, 'pointerup', 447)
    expect(onRelease).not.toHaveBeenCalled()
    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled()
  })

  it('never drags from another button in the header', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    pointer(get(container, 'close'), 'pointerdown', 450)
    pointer(window, 'pointermove', 300)
    pointer(window, 'pointerup', 300)
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('puts the sheet back on a cancelled gesture', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    const sheet = get(container, 'sheet')
    setHeight(sheet, 550)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    tick(100)
    pointer(window, 'pointermove', 300)
    pointer(window, 'pointercancel', 300)
    expect(onRelease).not.toHaveBeenCalled()
    expect(sheet.style.height).toBe('55%')
  })

  it('cancels a gesture whose release never arrived when a new press starts', () => {
    const onRelease = vi.fn()
    const { container } = render(<Harness detent={HALF} onRelease={onRelease} />)
    const sheet = get(container, 'sheet')
    setHeight(sheet, 550)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    tick(100)
    pointer(window, 'pointermove', 300)
    pointer(get(container, 'grabber'), 'pointerdown', 450)
    expect(sheet.style.height).toBe('55%')
    pointer(window, 'pointerup', 450)
    expect(onRelease).not.toHaveBeenCalled()
  })
})

describe('content drag', () => {
  const setup = (detent: Detent, contentDragOff = false) => {
    const onRelease = vi.fn()
    const onWasDrag = vi.fn()
    const r = render(<Harness detent={detent} onRelease={onRelease} contentDragOff={contentDragOff} onWasDrag={onWasDrag} />)
    setHeight(get(r.container, 'sheet'), AREA * [0.06, 0.55, 0.92][detent])
    return { ...r, onRelease, onWasDrag }
  }
  const swipe = (el: Element, from: number, to: number) => {
    touch(el, 'touchstart', [{ x: 100, y: from }])
    const moves: Event[] = []
    for (let i = 1; i <= 6; i++) {
      tick(100)
      moves.push(touch(el, 'touchmove', [{ x: 100, y: from + ((to - from) * i) / 6 }]))
    }
    touch(el, 'touchend', [])
    return moves
  }

  it('drags the sheet down from the top of the content', () => {
    const { container, onRelease } = setup(HALF)
    const moves = swipe(get(container, 'text'), 300, 800)
    expect(onRelease).toHaveBeenCalledWith(PEEK)
    expect(moves.at(-1)?.defaultPrevented).toBe(true)
  })

  it('scrolls instead when the content is scrolled down', () => {
    const { container, onRelease } = setup(FULL)
    get(container, 'content').scrollTop = 40
    swipe(get(container, 'text'), 300, 800)
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('grows the sheet on a swipe up until it is full', () => {
    const half = setup(HALF)
    swipe(get(half.container, 'text'), 800, 300)
    expect(half.onRelease).toHaveBeenCalledWith(FULL)
    half.unmount()
    const full = setup(FULL)
    swipe(get(full.container, 'text'), 800, 300)
    expect(full.onRelease).not.toHaveBeenCalled()
  })

  it('never starts on a text field, a touch-action:none element, or two fingers', () => {
    // jsdom drops touch-action from styles, so the grip's computed style is stubbed.
    const real = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) =>
      el instanceof HTMLElement && el.dataset.testid === 'grip' ? ({ touchAction: 'none' } as CSSStyleDeclaration) : real(el, pseudo))
    const { container, onRelease } = setup(HALF)
    swipe(get(container, 'field'), 300, 800)
    swipe(get(container, 'grip'), 300, 800)
    touch(get(container, 'text'), 'touchstart', [{ x: 1, y: 300 }, { x: 50, y: 300 }])
    tick(100)
    touch(get(container, 'text'), 'touchmove', [{ x: 1, y: 600 }, { x: 50, y: 600 }])
    touch(get(container, 'text'), 'touchend', [])
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('ignores a touch that lands on a fling still in motion', () => {
    const { container, onRelease } = setup(HALF)
    act(() => {
      get(container, 'content').dispatchEvent(new Event('scroll'))
    })
    tick(50)
    swipe(get(container, 'text'), 300, 800)
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('stays off while the keyboard is up', () => {
    const { container, onRelease } = setup(HALF, true)
    swipe(get(container, 'text'), 300, 800)
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('leaves a non-cancelable move to the browser', () => {
    const { container, onRelease } = setup(HALF)
    const text = get(container, 'text')
    touch(text, 'touchstart', [{ x: 100, y: 300 }])
    tick(100)
    touch(text, 'touchmove', [{ x: 100, y: 500 }], false)
    touch(text, 'touchend', [])
    expect(onRelease).not.toHaveBeenCalled()
  })

  it('reports the click that ends a drag as a drag, and a later one as a tap', () => {
    const { container, onWasDrag } = setup(HALF)
    const text = get(container, 'text')
    swipe(text, 300, 800)
    act(() => {
      text.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(onWasDrag).toHaveBeenLastCalledWith(true)
    tick(400)
    act(() => {
      text.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(onWasDrag).toHaveBeenLastCalledWith(false)
  })
})
