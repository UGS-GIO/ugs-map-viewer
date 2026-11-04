// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { buildStopsLink, createSharedStops, decodeStops, encodeStops, toStopHref, type SharedStop } from '../shared-stops'

const STOPS: SharedStop[] = [
  { label: 'Your parcel', href: '/hazards?zoom=15&lat=40.6&lon=-111.85&click_bbox=1,2,3,4' },
  { label: 'Fault zone', href: '/hazards?zoom=12&lat=40.5&lon=-111.8&tab=layers' },
]

describe('shared stops links', () => {
  it('round-trips stops through the compressed param', async () => {
    expect(await decodeStops(await encodeStops(STOPS))).toEqual(STOPS)
  })

  it('drops layout and preferences from a step, so the recipient keeps their own', () => {
    expect(toStopHref('/hazards?zoom=6&sidebar_collapsed=true&units=metric&sheet=half&tab=layers'))
      .toBe('/hazards?zoom=6&tab=layers')
  })

  it('opens on the first stop', async () => {
    const link = new URL(await buildStopsLink('https://maps.example', STOPS))
    expect(link.pathname).toBe('/hazards')
    expect(link.searchParams.get('zoom')).toBe('15')
    expect(link.searchParams.get('stops')).toBeTruthy()
  })

  it('ignores stops that are not paths in this app', async () => {
    const bad = await encodeStops([{ label: 'x', href: 'https://evil.example' }, ...STOPS])
    expect(await decodeStops(bad)).toEqual(STOPS)
  })
})

describe('createSharedStops', () => {
  beforeEach(() => sessionStorage.clear())

  it('reads a shared link, drops its param, and lists the stops as unseen', async () => {
    const link = new URL(await buildStopsLink('https://maps.example', STOPS))
    const history = createMemoryHistory({ initialEntries: [`${link.pathname}${link.search}`] })
    const shared = createSharedStops(history, sessionStorage)
    expect(new URLSearchParams(history.location.search).get('stops')).toBeNull()
    await vi.waitFor(() => expect(shared.getSnapshot().stops).toEqual(STOPS))
    expect(shared.getSnapshot().unseen).toBe(true)
    shared.markSeen()
    expect(shared.getSnapshot().unseen).toBe(false)
  })

  it('opens a stop as a new step, keeping the current layout', async () => {
    const history = createMemoryHistory({ initialEntries: ['/hazards?zoom=6&sidebar_collapsed=true'] })
    const shared = createSharedStops(history, sessionStorage)
    shared.open(STOPS[1])
    expect(history.location.state.__TSR_index).toBe(1)
    const params = new URLSearchParams(history.location.search)
    expect(params.get('zoom')).toBe('12')
    expect(params.get('sidebar_collapsed')).toBe('true')
  })
})
