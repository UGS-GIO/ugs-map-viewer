import { describe, expect, it } from 'vitest'
import {
  activeTabOf,
  clampSize,
  contentTakesDrag,
  DETENTS,
  FULL,
  HALF,
  heightPct,
  MORE_TAB,
  nearestDetent,
  PANEL_PEEK,
  parseDetail,
  parseSheet,
  PEEK,
  raise,
  releaseDetent,
  settleDetent,
  sheetFromUrl,
  sheetParam,
  tapTab,
  writeSheet,
  type SheetState,
} from './sheet-model'

describe('heightPct', () => {
  it('writes whole percents', () => {
    expect([PEEK, HALF, FULL].map(heightPct)).toEqual(['6%', '55%', '92%'])
  })
})

describe('nearestDetent', () => {
  it('picks the closest height', () => {
    expect(nearestDetent(0)).toBe(PEEK)
    expect(nearestDetent(0.2)).toBe(PEEK)
    expect(nearestDetent(0.5)).toBe(HALF)
    expect(nearestDetent(1)).toBe(FULL)
  })

  it('sends an exact midpoint to the lower height', () => {
    expect(nearestDetent((DETENTS[0] + DETENTS[1]) / 2)).toBe(PEEK)
    expect(nearestDetent((DETENTS[1] + DETENTS[2]) / 2)).toBe(HALF)
  })
})

describe('releaseDetent', () => {
  it('settles on the nearest height when slow', () => {
    expect(releaseDetent(0.5, 0.2)).toBe(HALF)
  })

  it('carries a flick one height further, however short the drag', () => {
    expect(releaseDetent(0.1, 2)).toBe(HALF)
    expect(releaseDetent(0.6, 2)).toBe(FULL)
    expect(releaseDetent(0.5, -2)).toBe(PEEK)
    expect(releaseDetent(0.9, -2)).toBe(HALF)
    expect(releaseDetent(DETENTS[1], -2)).toBe(PEEK)
    expect(releaseDetent(DETENTS[1], 2)).toBe(FULL)
  })

  it('stops at the ends', () => {
    expect(releaseDetent(DETENTS[2], 2)).toBe(FULL)
    expect(releaseDetent(DETENTS[0], -2)).toBe(PEEK)
  })
})

describe('settleDetent', () => {
  it('goes to the peek after a pull down, from any height and speed', () => {
    for (const frac of [0.06, 0.3, 0.55, 0.9]) {
      for (const speed of [-2, 0, 2]) expect(settleDetent(frac, speed, true)).toBe(PEEK)
    }
  })

  it('keeps the height rules otherwise, including an upward flick', () => {
    expect(settleDetent(0.5, 0.2, false)).toBe(HALF)
    expect(settleDetent(0.6, 2, false)).toBe(FULL)
    expect(settleDetent(0.1, 2, false)).toBe(releaseDetent(0.1, 2))
  })
})

describe('contentTakesDrag', () => {
  it('takes a downward swipe only from the top of the content', () => {
    expect(contentTakesDrag(0, 5, true, FULL)).toBe(true)
    expect(contentTakesDrag(0, 5, false, FULL)).toBe(false)
  })

  it('takes an upward swipe only while the sheet can grow', () => {
    expect(contentTakesDrag(0, -5, false, HALF)).toBe(true)
    expect(contentTakesDrag(0, -5, true, FULL)).toBe(false)
  })

  it('leaves a mostly sideways swipe alone', () => {
    expect(contentTakesDrag(6, 5, true, HALF)).toBe(false)
  })
})

describe('clampSize', () => {
  it('clamps and falls back on a non-number', () => {
    expect(clampSize(10, 100, 500, 200)).toBe(100)
    expect(clampSize(900, 100, 500, 200)).toBe(500)
    expect(clampSize(Number.NaN, 100, 500, 200)).toBe(200)
  })
})

describe('raise', () => {
  it('lifts a peek to half and leaves higher alone', () => {
    expect(raise(PEEK)).toBe(HALF)
    expect(raise(HALF)).toBe(HALF)
    expect(raise(FULL)).toBe(FULL)
  })
})

describe('the sheet param', () => {
  const all: SheetState[] = (['cards', 'table', null] as const).flatMap((results) =>
    [PEEK, HALF, FULL].map((detent) => ({ results, detent })),
  )

  it('round-trips every state', () => {
    for (const s of all) {
      const v = sheetParam(s)
      expect(v === undefined ? PANEL_PEEK : parseSheet(v)).toEqual(s)
    }
  })

  it('keeps the default URL bare', () => {
    expect(sheetParam(PANEL_PEEK)).toBeUndefined()
    expect(sheetParam({ results: 'table', detent: FULL })).toBe('table-full')
    expect(sheetParam({ results: null, detent: HALF })).toBe('half')
  })

  it('rejects what it never writes', () => {
    for (const bad of ['sideways', 'peek', 'cards', 'chart-half', 'table-half-full', '']) {
      expect(parseSheet(bad)).toBeNull()
    }
  })
})

describe('sheetFromUrl', () => {
  it('reads sheet first', () => {
    expect(sheetFromUrl('cards-half', 'table')).toEqual({ state: { results: 'cards', detent: HALF }, invalid: null })
  })

  it('opens a desktop view link as a results table', () => {
    expect(sheetFromUrl(undefined, 'split')).toEqual({ state: { results: 'table', detent: HALF }, invalid: null })
    expect(sheetFromUrl(undefined, 'table')).toEqual({ state: { results: 'table', detent: FULL }, invalid: null })
    expect(sheetFromUrl(undefined, 'map')).toEqual({ state: PANEL_PEEK, invalid: null })
    expect(sheetFromUrl(undefined, undefined)).toEqual({ state: PANEL_PEEK, invalid: null })
  })

  it('falls back to the panel peek and reports an unknown value', () => {
    expect(sheetFromUrl('garbage', undefined)).toEqual({ state: PANEL_PEEK, invalid: 'garbage' })
  })
})

describe('parseDetail', () => {
  it('accepts the three Info details and nothing else', () => {
    expect(parseDetail('references')).toBe('references')
    expect(parseDetail('disclaimer')).toBe('disclaimer')
    expect(parseDetail('acknowledgments')).toBe('acknowledgments')
    expect(parseDetail('credits')).toBeNull()
    expect(parseDetail('toString')).toBeNull()
  })
})

describe('writeSheet', () => {
  it('writes sheet, clears view, and keeps everything else', () => {
    const prev = { zoom: 9, tab: 'layers', view: 'table' as const, sheet: 'table-full', detail: 'references' }
    expect(writeSheet(prev, { results: null, detent: HALF })).toEqual({
      zoom: 9, tab: 'layers', view: undefined, sheet: 'half', detail: 'references',
    })
  })

  it('sets tab and clears detail only when given a tab', () => {
    const prev = { tab: 'info', detail: 'references', sheet: 'half' }
    expect(writeSheet(prev, { results: null, detent: HALF }, 'layers')).toEqual({
      tab: 'layers', detail: undefined, sheet: 'half', view: undefined,
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
