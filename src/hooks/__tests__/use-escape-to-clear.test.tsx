// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useEscapeToClear } from '../use-escape-to-clear'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mounted: (() => void)[] = []
afterEach(() => {
  mounted.splice(0).forEach((unmount) => unmount())
  document.body.innerHTML = ''
})

function mount(enabled: boolean) {
  const onClear = vi.fn()
  function Probe() {
    useEscapeToClear(enabled, onClear)
    return null
  }
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  act(() => root.render(<Probe />))
  let done = false
  const unmount = () => {
    if (done) return
    done = true
    act(() => root.unmount())
  }
  mounted.push(unmount)
  return { onClear, unmount }
}

const press = (target: EventTarget, key = 'Escape', prevent = false) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  if (prevent) e.preventDefault()
  target.dispatchEvent(e)
}

describe('useEscapeToClear', () => {
  it('clears on an unclaimed Escape and ignores other keys', () => {
    const { onClear, unmount } = mount(true)
    press(document.body, 'Enter')
    expect(onClear).not.toHaveBeenCalled()
    press(document.body)
    expect(onClear).toHaveBeenCalledTimes(1)
    unmount()
    press(document.body)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled, as when a map tool owns Escape', () => {
    const { onClear } = mount(false)
    press(document.body)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('leaves Escape to fields, open dialogs and handled events', () => {
    const { onClear } = mount(true)
    press(document.body.appendChild(document.createElement('input')))
    press(document.body, 'Escape', true)
    const dialog = document.body.appendChild(document.createElement('div'))
    dialog.setAttribute('role', 'dialog')
    press(document.body)
    expect(onClear).not.toHaveBeenCalled()
    dialog.remove()
    press(document.body)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
