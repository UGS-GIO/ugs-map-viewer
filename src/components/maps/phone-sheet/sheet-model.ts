// The phone sheet's pure logic: which tab is showing, and the `sheet` and `detail` URL params.
// Ported from the ugs-warehouse viewer's map-model so the UGS viewers agree.

export type Detent = 0 | 1 | 2
export const PEEK: Detent = 0
export const HALF: Detent = 1
export const FULL: Detent = 2

export const raise = (d: Detent): Detent => (d < HALF ? HALF : d)

export type ResultsView = 'cards' | 'table'
export type SheetState = { results: ResultsView | null; detent: Detent }
export const PANEL_PEEK: SheetState = { results: null, detent: PEEK }

// The URL's `sheet` (absent at the peek) and `results` (absent while a panel shows); _map.tsx
// validates both against these lists.
export const SHEET_PARAMS = ['half', 'full'] as const
export const RESULTS_PARAMS = ['cards', 'table'] as const
const SHEET_AT = [undefined, 'half', 'full'] as const
const DETENT_OF = { half: HALF, full: FULL } as const

type SheetSearch = { sheet?: (typeof SHEET_PARAMS)[number]; results?: ResultsView; view?: 'map' | 'split' | 'table' }

// A desktop link's split or table view opens as a results table on a phone.
export function sheetFromUrl({ sheet, results, view }: SheetSearch): SheetState {
  if (sheet || results) return { results: results ?? null, detent: sheet ? DETENT_OF[sheet] : PEEK }
  if (view === 'split') return { results: 'table', detent: HALF }
  if (view === 'table') return { results: 'table', detent: FULL }
  return PANEL_PEEK
}

export const INFO_DETAILS = ['references', 'acknowledgments', 'disclaimer'] as const
export type InfoDetail = (typeof INFO_DETAILS)[number]
export const INFO_DETAIL_TITLE: Record<InfoDetail, string> = {
  references: 'References',
  acknowledgments: 'Acknowledgments',
  disclaimer: 'Data Disclaimer',
}

// Clearing `view` keeps a desktop link's split or table view from overriding the sheet afterwards;
// a new tab drops the Info detail that belonged to the old one.
export function writeSheet<T extends object>(prev: T, next: SheetState, tab?: string) {
  const sheet = { ...prev, sheet: SHEET_AT[next.detent], results: next.results ?? undefined, view: undefined }
  return tab === undefined ? sheet : { ...sheet, tab, detail: undefined }
}

export type Step = (cur: SheetState, tab: string) => { sheet: SheetState; tab?: string }

// Applies a step to the URL it reads, so a raise queued behind another navigation is never stale.
export function applyStep<T extends SheetSearch & { tab?: string }>(prev: T, step: Step) {
  const next = step(sheetFromUrl(prev), prev.tab ?? 'info')
  return writeSheet(prev, next.sheet, next.tab)
}

// Shows a panel, raising a sheet at the peek to half.
export const openPanelStep = (tab: string): Step => (cur) => ({ sheet: { results: null, detent: raise(cur.detent) }, tab })

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
