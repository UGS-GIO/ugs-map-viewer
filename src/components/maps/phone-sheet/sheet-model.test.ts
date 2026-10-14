import { describe, expect, it } from 'vitest'
import {
  activeTabOf,
  FULL,
  HALF,
  MORE_TAB,
  PANEL_PEEK,
  PEEK,
  raise,
  sheetFromUrl,
  tapTab,
  writeSheet,
  type SheetState,
} from './sheet-model'

describe('raise', () => {
  it('lifts a peek to half and leaves higher alone', () => {
    expect(raise(PEEK)).toBe(HALF)
    expect(raise(HALF)).toBe(HALF)
    expect(raise(FULL)).toBe(FULL)
  })
})

describe('the sheet params', () => {
  const all: SheetState[] = (['cards', 'table', null] as const).flatMap((results) =>
    [PEEK, HALF, FULL].map((detent) => ({ results, detent })),
  )

  it('round-trips every state', () => {
    for (const s of all) expect(sheetFromUrl(writeSheet({}, s))).toEqual(s)
  })

  it('keeps the default URL bare', () => {
    expect(writeSheet({}, PANEL_PEEK)).toEqual({ sheet: undefined, results: undefined, view: undefined })
    expect(writeSheet({}, { results: 'table', detent: FULL })).toMatchObject({ sheet: 'full', results: 'table' })
  })
})

describe('sheetFromUrl', () => {
  it('reads sheet and results before view', () => {
    expect(sheetFromUrl({ sheet: 'half', results: 'cards', view: 'table' })).toEqual({ results: 'cards', detent: HALF })
    expect(sheetFromUrl({ results: 'table', view: 'split' })).toEqual({ results: 'table', detent: PEEK })
  })

  it('opens a desktop view link as a results table', () => {
    expect(sheetFromUrl({ view: 'split' })).toEqual({ results: 'table', detent: HALF })
    expect(sheetFromUrl({ view: 'table' })).toEqual({ results: 'table', detent: FULL })
    expect(sheetFromUrl({ view: 'map' })).toEqual(PANEL_PEEK)
    expect(sheetFromUrl({})).toEqual(PANEL_PEEK)
  })
})

describe('writeSheet', () => {
  it('writes sheet and results, clears view, and keeps everything else', () => {
    const prev = { zoom: 9, tab: 'layers', view: 'table' as const, sheet: 'full' as const, results: 'table' as const, detail: 'references' as const }
    expect(writeSheet(prev, { results: null, detent: HALF })).toEqual({
      zoom: 9, tab: 'layers', view: undefined, sheet: 'half', results: undefined, detail: 'references',
    })
  })

  it('sets tab and clears detail only when given a tab', () => {
    const prev = { tab: 'info', detail: 'references', sheet: 'half' }
    expect(writeSheet(prev, { results: null, detent: HALF }, 'layers')).toEqual({
      tab: 'layers', detail: undefined, sheet: 'half', results: undefined, view: undefined,
    })
  })
})

describe('activeTabOf', () => {
  it('shows Results whenever results are open', () => {
    expect(activeTabOf({ results: 'cards', detent: PEEK }, 'layers')).toBe('results')
  })

  it('maps panels to their tab, and everything else to More', () => {
    expect(activeTabOf(PANEL_PEEK, 'layers')).toBe('layers')
    expect(activeTabOf(PANEL_PEEK, 'info')).toBe('info')
    expect(activeTabOf(PANEL_PEEK, MORE_TAB)).toBe('more')
    expect(activeTabOf(PANEL_PEEK, 'map configurations')).toBe('more')
    expect(activeTabOf(PANEL_PEEK, 'report generator')).toBe('more')
  })
})

describe('tapTab', () => {
  it('drops the showing tab to the peek', () => {
    expect(tapTab({ results: null, detent: HALF }, 'layers', 'layers')).toEqual({ sheet: { results: null, detent: PEEK } })
    expect(tapTab({ results: 'table', detent: FULL }, 'layers', 'results')).toEqual({ sheet: { results: 'table', detent: PEEK } })
  })

  it('raises the tab at the peek to half', () => {
    expect(tapTab(PANEL_PEEK, 'layers', 'layers')).toEqual({ sheet: { results: null, detent: HALF } })
  })

  it('opens another tab at half, or keeps a higher sheet', () => {
    expect(tapTab(PANEL_PEEK, 'layers', 'info')).toEqual({ sheet: { results: null, detent: HALF }, tab: 'info' })
    expect(tapTab({ results: null, detent: FULL }, 'layers', 'info')).toEqual({ sheet: { results: null, detent: FULL }, tab: 'info' })
  })

  it('opens More on its list and Results as cards', () => {
    expect(tapTab(PANEL_PEEK, 'info', 'more')).toEqual({ sheet: { results: null, detent: HALF }, tab: MORE_TAB })
    expect(tapTab(PANEL_PEEK, 'info', 'results')).toEqual({ sheet: { results: 'cards', detent: HALF } })
  })

  it('reopens a More panel at the peek where the user left it', () => {
    expect(tapTab(PANEL_PEEK, 'map configurations', 'more')).toEqual({ sheet: { results: null, detent: HALF } })
  })

  it('opens the More list when coming from Results', () => {
    expect(tapTab({ results: 'cards', detent: HALF }, 'map configurations', 'more')).toEqual({ sheet: { results: null, detent: HALF }, tab: MORE_TAB })
  })

  it('leaves Results for a panel tab', () => {
    expect(tapTab({ results: 'cards', detent: HALF }, 'layers', 'layers')).toEqual({ sheet: { results: null, detent: HALF }, tab: 'layers' })
  })
})
