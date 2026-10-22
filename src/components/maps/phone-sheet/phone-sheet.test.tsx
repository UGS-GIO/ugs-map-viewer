// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PhoneSheet, type PhoneSheetProps } from './phone-sheet'
import { FULL, HALF, PEEK } from './sheet-model'
import { act, render } from './test-utils'

const area = { current: document.body }
const base = (over: Partial<PhoneSheetProps> = {}): PhoneSheetProps => ({
  container: area,
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
    const { rerender } = render(<PhoneSheet {...props} />)
    click(tab(document.body, 'Info'))
    expect(props.onSelectTab).toHaveBeenCalledWith('info')
    expect(tab(document.body, 'Layers').getAttribute('aria-pressed')).toBe('true')
    expect(tab(document.body, 'Info').getAttribute('aria-pressed')).toBe('false')
    // Pressing the showing tab again reports that tab, which drops the sheet to the peek.
    click(tab(document.body, 'Layers'))
    expect(props.onSelectTab).toHaveBeenLastCalledWith('layers')
    rerender(<PhoneSheet {...base({ detent: PEEK })} />)
    expect(tab(document.body, 'Layers').getAttribute('aria-pressed')).toBe('false')
  })

  it('steps the height from the grabber and names the next step', () => {
    const props = base({ detent: FULL })
    render(<PhoneSheet {...props} />)
    const grabber = q(document.body, 'button[aria-label$="panel"], button[aria-label^="Expand"]')
    expect(grabber.getAttribute('aria-label')).toBe('Collapse panel')
    click(grabber)
    expect(props.onSetDetent).toHaveBeenCalledWith(PEEK)
  })

  it('steps with the arrow keys and stops at the ends', () => {
    const props = base({ detent: FULL })
    render(<PhoneSheet {...props} />)
    const grabber = q(document.body, 'button[aria-label$="panel"], button[aria-label^="Expand"]')
    key(grabber, 'ArrowUp')
    expect(props.onSetDetent).toHaveBeenLastCalledWith(FULL)
    key(grabber, 'ArrowDown')
    expect(props.onSetDetent).toHaveBeenLastCalledWith(HALF)
  })

  it('drops to the peek on Escape instead of closing', () => {
    const props = base()
    render(<PhoneSheet {...props} />)
    key(q(document.body, '.phone-sheet-content p'), 'Escape')
    expect(props.onSetDetent).toHaveBeenCalledWith(PEEK)
  })

  it('makes the content inert at the peek and shows the summary there', () => {
    const { rerender } = render(<PhoneSheet {...base({ detent: PEEK, summary: '3 layers on' })} />)
    expect(q(document.body, '[inert]')).not.toBeNull()
    expect(document.body.textContent).toContain('3 layers on')
    rerender(<PhoneSheet {...base({ detent: HALF, summary: '3 layers on' })} />)
    expect(q(document.body, '[inert]')).toBeNull()
    expect(document.body.textContent).not.toContain('3 layers on')
  })

  it('has no close button, and shows a back control only when given', () => {
    const back = { label: 'More', onClick: vi.fn() }
    const { rerender } = render(<PhoneSheet {...base()} />)
    expect(q(document.body, 'button[aria-label="Clear results"]')).toBeNull()
    rerender(<PhoneSheet {...base({ back })} />)
    const backButton = [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'More' && !b.closest('nav'))!
    click(backButton)
    expect(back.onClick).toHaveBeenCalled()
  })

  it('focuses the title when the panel changes, not on first render or a title update', () => {
    const { rerender } = render(<PhoneSheet {...base({ title: '' })} />)
    rerender(<PhoneSheet {...base({ title: 'Layers' })} />)
    expect(document.activeElement).not.toBe(q(document.body, 'h2'))
    rerender(<PhoneSheet {...base({ activeTab: 'info', panelKey: 'info:info', title: 'Info' })} />)
    expect(document.activeElement).toBe(q(document.body, 'h2'))
  })
})
