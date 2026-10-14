// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPortal } from 'react-dom'
import { PhoneSheet, type PhoneSheetProps } from './phone-sheet'
import { FULL, HALF, PEEK } from './sheet-model'
import { act, render } from './test-utils'

const base = (over: Partial<PhoneSheetProps> = {}): PhoneSheetProps => ({
  map: <div data-testid="map" />,
  detent: HALF,
  activeTab: 'layers',
  panelKey: 'layers:layers',
  title: 'Layers',
  onSelectTab: vi.fn(),
  onSetDetent: vi.fn(),
  children: <p>panel</p>,
  ...over,
})

const q = (c: HTMLElement, sel: string) => c.querySelector(sel) as HTMLElement
const tab = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll('nav[aria-label="Map views"] button')].find((b) => b.textContent === label) as HTMLButtonElement
const click = (el: Element, detail = 1) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
})
const key = (el: Element, k: string, prevent = false) => act(() => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: k })
  if (prevent) e.preventDefault()
  el.dispatchEvent(e)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PhoneSheet', () => {
  it('reports tab taps and highlights the showing tab only while raised', () => {
    const props = base()
    const { container, rerender } = render(<PhoneSheet {...props} />)
    click(tab(container, 'Info'))
    expect(props.onSelectTab).toHaveBeenCalledWith('info')
    expect(tab(container, 'Layers').getAttribute('aria-current')).toBe('page')
    expect(tab(container, 'Layers').getAttribute('aria-expanded')).toBe('true')
    expect(tab(container, 'Info').hasAttribute('aria-current')).toBe(false)
    rerender(<PhoneSheet {...base({ detent: PEEK })} />)
    expect(tab(container, 'Layers').hasAttribute('aria-current')).toBe(false)
    expect(tab(container, 'Layers').getAttribute('aria-expanded')).toBe('false')
  })

  it('steps the height from the grabber and names the next step', () => {
    const props = base({ detent: FULL })
    const { container } = render(<PhoneSheet {...props} />)
    const grabber = q(container, '[data-grabber]')
    expect(grabber.getAttribute('aria-label')).toBe('Collapse panel')
    click(grabber)
    expect(props.onSetDetent).toHaveBeenCalledWith(PEEK)
  })

  it('steps with the arrow keys and stops at the ends', () => {
    const props = base({ detent: FULL })
    const { container } = render(<PhoneSheet {...props} />)
    const grabber = q(container, '[data-grabber]')
    key(grabber, 'ArrowUp')
    expect(props.onSetDetent).toHaveBeenLastCalledWith(FULL)
    key(grabber, 'ArrowDown')
    expect(props.onSetDetent).toHaveBeenLastCalledWith(HALF)
  })

  it('drops to the peek on Escape from its own content', () => {
    const props = base()
    const { container } = render(<PhoneSheet {...props} />)
    key(q(container, 'section p'), 'Escape')
    expect(props.onSetDetent).toHaveBeenCalledWith(PEEK)
  })

  it('leaves Escape to a popover portaled out of the sheet, or one that handled it', () => {
    const portalHost = document.createElement('div')
    document.body.append(portalHost)
    const props = base({
      children: (
        <>
          <p data-testid="inside">panel</p>
          {createPortal(<button type="button" data-testid="popover">option</button>, portalHost)}
        </>
      ),
    })
    const { container } = render(<PhoneSheet {...props} />)
    key(portalHost.querySelector('[data-testid="popover"]')!, 'Escape')
    key(q(container, '[data-testid="inside"]'), 'Escape', true)
    expect(props.onSetDetent).not.toHaveBeenCalled()
  })

  it('makes the content inert at the peek and shows the summary there', () => {
    const { container, rerender } = render(<PhoneSheet {...base({ detent: PEEK, summary: '3 layers on' })} />)
    expect(q(container, '[inert]')).not.toBeNull()
    expect(container.textContent).toContain('3 layers on')
    rerender(<PhoneSheet {...base({ detent: HALF, summary: '3 layers on' })} />)
    expect(q(container, '[inert]')).toBeNull()
    expect(container.textContent).not.toContain('3 layers on')
  })

  it('shows a close button and a back control only when given, and focuses the grabber after closing', () => {
    const onClose = vi.fn()
    const back = { label: 'More', onClick: vi.fn() }
    const { container, rerender } = render(<PhoneSheet {...base()} />)
    expect(q(container, 'button[aria-label="Clear results"]')).toBeNull()
    rerender(<PhoneSheet {...base({ onClose, closeLabel: 'Clear results', back })} />)
    click(q(container, 'button[aria-label="Clear results"]'))
    expect(onClose).toHaveBeenCalled()
    expect(document.activeElement).toBe(q(container, '[data-grabber]'))
    const backButton = [...container.querySelectorAll('section button')].find((b) => b.textContent === 'More')!
    click(backButton)
    expect(back.onClick).toHaveBeenCalled()
  })

  it('keeps touches inside the sheet from reaching the map', () => {
    const onDocTouch = vi.fn()
    document.addEventListener('touchstart', onDocTouch)
    const { container } = render(<PhoneSheet {...base()} />)
    act(() => {
      const e = new Event('touchstart', { bubbles: true })
      Object.defineProperty(e, 'touches', { value: [{ clientX: 0, clientY: 0 }] })
      q(container, 'section p').dispatchEvent(e)
    })
    expect(onDocTouch).not.toHaveBeenCalled()
    document.removeEventListener('touchstart', onDocTouch)
  })

  it('focuses the title when the panel changes, not on first render or a title update', () => {
    const { container, rerender } = render(<PhoneSheet {...base({ title: '' })} />)
    rerender(<PhoneSheet {...base({ title: 'Layers' })} />)
    expect(document.activeElement).not.toBe(q(container, 'h2'))
    rerender(<PhoneSheet {...base({ activeTab: 'info', panelKey: 'info:info', title: 'Info' })} />)
    expect(document.activeElement).toBe(q(container, 'h2'))
  })
})
