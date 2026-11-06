// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { createMapSteps, describeStep } from '../map-steps'

const at = (search: string) => `/hazards?${search}`
const view = (search: string) => at(`lat=1&lon=1&${search}`)

describe('describeStep', () => {
  it('names what changed between two steps', () => {
    expect(describeStep(undefined, at('zoom=6'))).toBe('Start')
    expect(describeStep(at('zoom=6&lat=1&lon=1'), at('zoom=8&lat=1&lon=1'))).toBe('Zoomed in')
    expect(describeStep(at('zoom=6&lat=1&lon=1'), at('zoom=6&lat=2&lon=1'))).toBe('Moved map')
    expect(describeStep(at('zoom=6&lat=1&lon=1'), at('zoom=7&lat=1.2&lon=1'))).toBe('Zoomed in')
    expect(describeStep(at('zoom=6&lat=1&lon=1&tab=info'), at('zoom=6&lat=1.000001&lon=1&tab=layers'))).toBe('Layers panel')
    expect(describeStep(at('zoom=6'), at('zoom=6&click_bbox=1,2,3,4'))).toBe('Selected features')
    expect(describeStep(at('zoom=6&click_bbox=1,2,3,4'), at('zoom=6'))).toBe('Cleared selection')
    expect(describeStep(at('tab=info'), at('tab=layers'))).toBe('Layers panel')
    expect(describeStep(at('zoom=6'), at('zoom=6&basemap=liberty'))).toBe('Basemap: Streets')
    expect(describeStep('/hazards?zoom=6', '/wetlands?zoom=6')).toBe('Opened Wetlands')
  })

  it('ignores layout and preference changes', () => {
    expect(describeStep(at('zoom=6'), at('zoom=6&sidebar_collapsed=true'))).toBe('Map view')
  })
})

describe('createMapSteps', () => {
  beforeEach(() => sessionStorage.clear())

  function setup() {
    const history = createMemoryHistory({ initialEntries: [view('zoom=6')] })
    return { history, steps: createMapSteps(history, sessionStorage, false) }
  }

  it('lists steps as they are pushed and replaced, and jumps between them', () => {
    const { history, steps } = setup()
    history.push(view('zoom=7'))
    history.replace(view('zoom=7.5'))
    history.push(view('zoom=8'))
    expect(steps.getSnapshot().steps.map((s) => s.href)).toEqual([view('zoom=6'), view('zoom=7.5'), view('zoom=8')])
    expect(steps.getSnapshot().current).toBe(2)

    steps.go(0)
    expect(history.location.search).toBe('?lat=1&lon=1&zoom=6')
    expect(steps.getSnapshot().current).toBe(0)
  })

  it('labels a step and drops labels for steps a new push replaces', () => {
    const { history, steps } = setup()
    history.push(view('zoom=7'))
    history.push(view('zoom=8'))
    steps.setLabel(0, 'A')
    steps.setLabel(2, 'B')
    expect(steps.getSnapshot().steps.map((s) => s.label)).toEqual(['A', undefined, 'B'])

    steps.go(1)
    history.push(view('zoom=9'))
    expect(steps.getSnapshot().steps.map((s) => s.label)).toEqual(['A', undefined, undefined])
    expect(steps.getSnapshot().steps).toHaveLength(3)
  })

  it('clears a label set to blank, and keeps steps and labels across a reload', () => {
    const { history, steps } = setup()
    history.push(view('zoom=7'))
    steps.setLabel(1, 'Parcel')
    steps.setLabel(0, '  ')
    const reloaded = createMapSteps(history, sessionStorage, false)
    expect(reloaded.getSnapshot().steps.map((s) => s.label)).toEqual([undefined, 'Parcel'])
  })

  it('keeps a labeled step\'s note, drops it with the label, and drops it for replaced steps', () => {
    const { history, steps } = setup()
    history.push(view('zoom=7'))
    steps.setLabel(0, 'A', '  Look here  ')
    steps.setLabel(1, '', 'Unlabeled')
    expect(steps.getSnapshot().steps.map((s) => s.note)).toEqual(['Look here', undefined])
    expect(createMapSteps(history, sessionStorage, false).getSnapshot().steps[0].note).toBe('Look here')

    steps.setLabel(0, '')
    expect(steps.getSnapshot().steps[0].note).toBeUndefined()

    steps.setLabel(1, 'B', 'Gone soon')
    steps.go(0)
    history.push(view('zoom=9'))
    expect(steps.getSnapshot().steps.map((s) => s.note)).toEqual([undefined, undefined])
  })

  it('lists only map views', () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    const steps = createMapSteps(history, sessionStorage, false)
    history.push(view('zoom=6'))
    expect(steps.getSnapshot().steps.map((s) => s.index)).toEqual([1])
  })

  it('starts over when a new page load restarts the steps', () => {
    const { history, steps } = setup()
    history.push(view('zoom=7'))
    steps.setLabel(1, 'Parcel')
    const fresh = createMapSteps(createMemoryHistory({ initialEntries: [view('zoom=9')] }), sessionStorage, true)
    expect(fresh.getSnapshot().steps.map((s) => [s.href, s.label])).toEqual([[view('zoom=9'), undefined]])
  })
})

describe('readJson', () => {
  it('falls back on a stored null', async () => {
    const { readJson } = await import('../session-json')
    sessionStorage.setItem('x', 'null')
    expect(readJson(sessionStorage, 'x', [])).toEqual([])
    expect(readJson(undefined, 'x', {})).toEqual({})
  })
})
