// The phone sheet's pure logic: its heights, where a drag settles, which tab is showing, and the
// `sheet` and `detail` URL params. Ported from the ugs-warehouse viewer's map-model so the UGS
// viewers agree.

// Sheet heights as fractions of the map area: peek / half / full.
export const DETENTS = [0.06, 0.55, 0.92] as const
export type Detent = 0 | 1 | 2
export const PEEK: Detent = 0
export const HALF: Detent = 1
export const FULL: Detent = 2

// Whole percents: DETENTS[d] * 100 is 55.00000000000001 for half.
export const heightPct = (d: Detent) => `${Math.round(DETENTS[d] * 100)}%`

// Ties go to the lower height, which shows more map. The epsilon makes that hold: an exact
// midpoint is rarely exact in floating point and would otherwise land a hair nearer the upper one.
export function nearestDetent(frac: number): Detent {
  let best = 0
  for (let i = 1; i < DETENTS.length; i++) {
    if (Math.abs(DETENTS[i] - frac) < Math.abs(DETENTS[best] - frac) - 1e-9) best = i
  }
  return best as Detent
}

// A flick (speed in sheet-heights per second, + is up) goes one height past where the sheet is.
export const FLICK_SPEED = 0.8
export function releaseDetent(frac: number, speed: number): Detent {
  if (speed > FLICK_SPEED) return Math.min(DETENTS.filter((d) => d <= frac + 1e-9).length, DETENTS.length - 1) as Detent
  if (speed < -FLICK_SPEED) return Math.max(DETENTS.filter((d) => d < frac - 1e-9).length - 1, 0) as Detent
  return nearestDetent(frac)
}

// A pull down minimizes the sheet; other releases keep the height rules.
export function settleDetent(frac: number, speed: number, pulledDown: boolean): Detent {
  return pulledDown ? PEEK : releaseDetent(frac, speed)
}

// Whether a swipe on the content moves the sheet instead of scrolling it (dy + is down): down only
// from the top, up only while the sheet can still grow, which is how iOS sheets behave.
export function contentTakesDrag(dx: number, dy: number, atTop: boolean, detent: Detent): boolean {
  if (Math.abs(dy) <= Math.abs(dx)) return false
  return dy > 0 ? atTop : detent < FULL
}

export function clampSize(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export const raise = (d: Detent): Detent => (d < HALF ? HALF : d)

export type ResultsView = 'cards' | 'table'
export type SheetState = { results: ResultsView | null; detent: Detent }
export const PANEL_PEEK: SheetState = { results: null, detent: PEEK }

const AT = ['peek', 'half', 'full'] as const
const atOf = (s: string) => AT.indexOf(s as (typeof AT)[number])

// A panel is `half` or `full` (absent at the peek); Results is `<cards|table>-<peek|half|full>`.
export function sheetParam({ results, detent }: SheetState): string | undefined {
  if (!results) return detent === PEEK ? undefined : AT[detent]
  return `${results}-${AT[detent]}`
}

// Null for anything sheetParam never writes.
export function parseSheet(value: string): SheetState | null {
  const parts = value.split('-')
  if (parts.length === 1) {
    const d = atOf(parts[0])
    return d > PEEK ? { results: null, detent: d as Detent } : null
  }
  const [view, at] = parts
  const d = atOf(at)
  if (parts.length !== 2 || (view !== 'cards' && view !== 'table') || d < 0) return null
  return { results: view, detent: d as Detent }
}

export type ViewParam = 'map' | 'split' | 'table' | undefined

// A desktop link's split or table view opens as a results table on a phone.
export function sheetFromUrl(sheet: string | undefined, view: ViewParam): { state: SheetState; invalid: string | null } {
  if (sheet !== undefined) {
    const parsed = parseSheet(sheet)
    return parsed ? { state: parsed, invalid: null } : { state: PANEL_PEEK, invalid: sheet }
  }
  if (view === 'split') return { state: { results: 'table', detent: HALF }, invalid: null }
  if (view === 'table') return { state: { results: 'table', detent: FULL }, invalid: null }
  return { state: PANEL_PEEK, invalid: null }
}

export type InfoDetail = 'references' | 'acknowledgments' | 'disclaimer'
export const INFO_DETAIL_TITLE: Record<InfoDetail, string> = {
  references: 'References',
  acknowledgments: 'Acknowledgments',
  disclaimer: 'Data Disclaimer',
}
// hasOwnProperty, not `in`: `'toString' in INFO_DETAIL_TITLE` is true. (tsconfig's lib is ES2020, so no Object.hasOwn.)
export const parseDetail = (value: string): InfoDetail | null =>
  Object.prototype.hasOwnProperty.call(INFO_DETAIL_TITLE, value) ? (value as InfoDetail) : null

// Clearing `view` keeps a desktop link's split or table view from overriding the sheet afterwards;
// a new tab drops the Info detail that belonged to the old one.
export function writeSheet<T extends object>(prev: T, next: SheetState, tab?: string) {
  const sheet = { ...prev, sheet: sheetParam(next), view: undefined }
  return tab === undefined ? sheet : { ...sheet, tab, detail: undefined }
}

export type PhoneTab = 'layers' | 'results' | 'info' | 'more'

// The sidebar context's tab value for "no panel", which the phone shows as the More list.
export const MORE_TAB = 'home'

export function activeTabOf(state: SheetState, tab: string): PhoneTab {
  if (state.results) return 'results'
  if (tab === 'layers' || tab === 'info') return tab
  return 'more'
}

// A tap on the showing tab toggles it between the peek and half; any other tab opens at half or
// keeps a higher sheet. More reopens on whichever More panel was showing, unless Results was.
export function tapTab(state: SheetState, tab: string, target: PhoneTab): { sheet: SheetState; tab?: string } {
  if (target === activeTabOf(state, tab)) {
    return { sheet: { ...state, detent: state.detent === PEEK ? HALF : PEEK } }
  }
  const detent = raise(state.detent)
  if (target === 'results') return { sheet: { results: 'cards', detent } }
  if (target === 'more') {
    const onMorePanel = !state.results && activeTabOf(PANEL_PEEK, tab) === 'more'
    return onMorePanel ? { sheet: { results: null, detent } } : { sheet: { results: null, detent }, tab: MORE_TAB }
  }
  return { sheet: { results: null, detent }, tab: target }
}
