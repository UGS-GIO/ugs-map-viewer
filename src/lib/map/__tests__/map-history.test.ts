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

  it('keeps a write long after the last input as a replace, such as a slow query\'s derived bbox', () => {
    const { input, history, index } = setup()
    input()
    vi.advanceTimersByTime(1500)
    history.replace('/hazards?zoom=6&feature_bbox=1,2,3,4')
    expect(index()).toBe(0)
  })

  it('steps for a move an input started, even when it lands after the window', () => {
    const { input, history, index, moveStarted } = setup()
    input()
    const moveEnded = moveStarted()
    vi.advanceTimersByTime(2000)
    moveEnded()
    history.replace('/hazards?zoom=6.5')
    expect(index()).toBe(1)
  })

  it('leaves layout and preference changes as replaces', () => {
    const { input, write, index } = setup()
    input()
    write('zoom=6&sidebar_collapsed=true&units=metric&sheet=half')
    expect(index()).toBe(0)
  })

  it('makes a panel change its own step', () => {
    const { input, write, index } = setup()
    input()
    write('zoom=6&click_bbox=1,2,3,4')
    input()
    write('zoom=6&click_bbox=1,2,3,4&tab=layers')
    expect(index()).toBe(2)
  })

  it('keeps layout and preferences as they are on Back, but not the sheet height', () => {
    const { input, write, history } = setup()
    input()
    write('zoom=7&sheet=half')
    input()
    write('zoom=7&sheet=half&sidebar_collapsed=true&units=metric')
    history.back()
    const params = new URLSearchParams(history.location.search)
    expect(params.get('zoom')).toBe('6')
    expect(params.get('sidebar_collapsed')).toBe('true')
    expect(params.get('units')).toBe('metric')
    expect(params.get('sheet')).toBeNull()
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
