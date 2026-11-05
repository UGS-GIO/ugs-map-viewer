// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'
import { buildStopsLink, createSharedStops, decodeStops, encodeStops, fitsInLink, MAX_LINK_LENGTH, stopsFromFile, stopsToFile, toStopHref, type SharedStop } from '../shared-stops'

const STOPS: SharedStop[] = [
  { label: 'Your parcel', href: '/hazards?zoom=15&lat=40.6&lon=-111.85&click_bbox=1,2,3,4' },
  { label: 'Fault zone', href: '/hazards?zoom=12&lat=40.5&lon=-111.8&tab=layers' },
]

describe('shared stops links', () => {
  it('round-trips stops through the compressed param', async () => {
    expect(decodeStops(encodeStops(STOPS))).toEqual(STOPS)
  })

  it('carries a stop\'s note, and leaves it off stops without one', () => {
    const withNote = [{ ...STOPS[0], note: 'Your home is on the line\nCall us with questions' }, STOPS[1]]
    expect(decodeStops(encodeStops(withNote))).toEqual(withNote)
  })

  it('drops layout and preferences from a step, so the recipient keeps their own', () => {
    expect(toStopHref('/hazards?zoom=6&sidebar_collapsed=true&units=metric&sheet=half&tab=layers'))
      .toBe('/hazards?zoom=6&tab=layers')
  })

  it('presents from the first stop', async () => {
    const link = new URL(buildStopsLink('https://maps.example', STOPS))
    expect(link.pathname).toBe('/hazards')
    expect(link.searchParams.get('zoom')).toBe('15')
    expect(link.searchParams.get('present')).toBe('1')
    expect(link.searchParams.get('stops')).toBeTruthy()
  })

  it('keeps the presentation out of a stop', () => {
    expect(toStopHref('/hazards?zoom=6&present=2')).toBe('/hazards?zoom=6')
  })

  it('ignores stops that are not paths in this app', async () => {
    const bad = encodeStops([{ label: 'x', href: 'https://evil.example' }, { label: 'y', href: '//evil.example/a' }, { label: 'z', href: '/\\evil.example' }, ...STOPS])
    expect(decodeStops(bad)).toEqual(STOPS)
  })
})

describe('shared stops limits', () => {
  it('caps the stop count and label length, and refuses an oversized link', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ label: `${'L'.repeat(300)}${i}`, href: `/hazards?zoom=${i}` }))
    const decoded = decodeStops(encodeStops(many))
    expect(decoded).toHaveLength(50)
    expect(decoded[0].label).toHaveLength(200)
    expect(() => decodeStops('A'.repeat(16_001))).toThrow()
  })

  it('refuses a link that decompresses past the cap', () => {
    const huge = encodeStops([{ label: 'x'.repeat(300_000), href: '/hazards' }])
    expect(() => decodeStops(huge)).toThrow()
  })
})

describe('createSharedStops', () => {
  beforeEach(() => sessionStorage.clear())

  it('keeps the stops in a presenting URL, so it reloads and shares from any stop', async () => {
    const link = new URL(buildStopsLink('https://maps.example', STOPS))
    const history = createMemoryHistory({ initialEntries: [`${link.pathname}${link.search}`] })
    const shared = createSharedStops(history, sessionStorage)
    expect(shared.getSnapshot().stops).toEqual(STOPS)
    shared.open(STOPS[1], 2)
    const params = new URLSearchParams(history.location.search)
    expect(params.get('present')).toBe('2')
    expect(decodeStops(params.get('stops') ?? '')).toEqual(STOPS)
  })

  it('reads a shared link, drops its param, and lists the stops as unseen', async () => {
    const link = new URL(buildStopsLink('https://maps.example', STOPS))
    link.searchParams.delete('present')
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
    expect(params.get('present')).toBeNull()
  })

  it('presents stops: lists them and opens the first in the presentation', () => {
    const history = createMemoryHistory({ initialEntries: ['/hazards?zoom=6'] })
    const shared = createSharedStops(history, sessionStorage)
    shared.present(STOPS)
    expect(shared.getSnapshot()).toEqual({ stops: STOPS, unseen: false })
    const params = new URLSearchParams(history.location.search)
    expect(params.get('zoom')).toBe('15')
    expect(params.get('present')).toBe('1')
    shared.open(STOPS[1], 2)
    expect(new URLSearchParams(history.location.search).get('present')).toBe('2')
  })
})

describe('printable', () => {
  it('keeps what the PDF font draws and turns subscripts into digits', async () => {
    const { printable } = await import('@/components/maps/controls/steps-pdf')
    expect(printable('CO₂ storage — café 🙂')).toBe('CO2 storage  café ')
  })
})

describe('shared stops files', () => {
  const file = (body: unknown) => JSON.stringify(body)

  it('round-trips stops, notes included', () => {
    const withNote = [{ ...STOPS[0], note: 'Your home is on the line' }, STOPS[1]]
    expect(stopsFromFile(stopsToFile(withNote))).toEqual(withNote)
    expect(JSON.parse(stopsToFile(STOPS))).toMatchObject({ type: 'ugs-map-stops', version: 1 })
  })

  it('drops stops that a link would drop', () => {
    const text = file({ type: 'ugs-map-stops', version: 1, stops: [STOPS[0], { label: 'Off site', href: 'https://evil.example' }, { label: 3, href: '/x' }, 'nope', { ...STOPS[1], note: '' }] })
    expect(stopsFromFile(text)).toEqual(STOPS)
  })

  it('rejects files that are not stops files', () => {
    expect(() => stopsFromFile('not json')).toThrow()
    expect(() => stopsFromFile(file([STOPS]))).toThrow()
    expect(() => stopsFromFile(file({ type: 'FeatureCollection', features: [] }))).toThrow()
    expect(() => stopsFromFile(file({ type: 'ugs-map-stops', version: 2, stops: STOPS }))).toThrow()
    expect(() => stopsFromFile(file({ type: 'ugs-map-stops', version: 1, stops: {} }))).toThrow()
    expect(() => stopsFromFile(file({ type: 'ugs-map-stops', version: 1, stops: [{ label: 'x', href: 'x' }] }))).toThrow()
  })

  it('fits a link only up to the limit', () => {
    expect(fitsInLink('a'.repeat(MAX_LINK_LENGTH))).toBe(true)
    expect(fitsInLink('a'.repeat(MAX_LINK_LENGTH + 1))).toBe(false)
    expect(fitsInLink(buildStopsLink('https://maps.example', STOPS))).toBe(true)
  })
})
