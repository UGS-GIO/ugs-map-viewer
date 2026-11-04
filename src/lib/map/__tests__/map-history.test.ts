// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { createMapHistory } from '../map-history'

function setup() {
  const target = new EventTarget()
  const nav = createMapHistory(createMemoryHistory({ initialEntries: ['/hazards?zoom=6'] }), target)
  const { history } = nav
  const input = () => target.dispatchEvent(new Event('pointerdown'))
  const write = (search: string) => {
    history.replace(`/hazards?${search}`)
    vi.advanceTimersByTime(1000)
  }
  return { ...nav, input, write, index: () => history.location.state.__TSR_index }
}

describe('createMapHistory', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps writes nobody made as replaces', () => {
    const { write, index } = setup()
    write('zoom=7')
    expect(index()).toBe(0)
  })

  it('turns a user change to map state into a new entry', () => {
    const { input, write, index, history } = setup()
    input()
    write('zoom=7')
    expect(index()).toBe(1)
    expect(history.location.search).toBe('?zoom=7')
  })

  it('folds the writes that follow one input into its entry', () => {
    const { input, history, index } = setup()
    input()
    history.replace('/hazards?zoom=7')
    history.replace('/hazards?zoom=7&features=a:1')
    expect(index()).toBe(1)
  })

  it('folds writes closer together than the quiet window', () => {
    const { input, history, index } = setup()
    input()
    history.replace('/hazards?zoom=7')
    vi.advanceTimersByTime(100)
    input()
    history.replace('/hazards?zoom=8')
    expect(index()).toBe(1)
  })

  it('leaves panel-only changes as replaces', () => {
    const { input, write, index } = setup()
    input()
    write('zoom=6&sidebar_collapsed=true&tab=layers')
    expect(index()).toBe(0)
  })

  it('tracks whether a forward entry exists', () => {
    const { input, write, history, canGoForward } = setup()
    input()
    write('zoom=7')
    expect(canGoForward()).toBe(false)
    history.back()
    expect(canGoForward()).toBe(true)
  })

  it('does not record the move a traversal causes', () => {
    const { input, write, history, index, canGoForward } = setup()
    input()
    write('zoom=7')
    input() // the click on Back
    history.back()
    vi.advanceTimersByTime(1000)
    // The map lands on the restored camera and writes it back
    history.replace('/hazards?zoom=6.000001')
    expect(index()).toBe(0)
    expect(canGoForward()).toBe(true)
  })
})
