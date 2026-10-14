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

// Every `sheet` value the URL accepts; _map.tsx validates against this list.
export const SHEET_PARAMS = ['half', 'full', 'cards-peek', 'cards-half', 'cards-full', 'table-peek', 'table-half', 'table-full'] as const
export type SheetParam = (typeof SHEET_PARAMS)[number]

// A panel is `half` or `full` (absent at the peek); Results is `<cards|table>-<peek|half|full>`.
const SHEETS: Record<SheetParam, SheetState> = {
  half: { results: null, detent: HALF },
  full: { results: null, detent: FULL },
  'cards-peek': { results: 'cards', detent: PEEK },
  'cards-half': { results: 'cards', detent: HALF },
  'cards-full': { results: 'cards', detent: FULL },
  'table-peek': { results: 'table', detent: PEEK },
  'table-half': { results: 'table', detent: HALF },
  'table-full': { results: 'table', detent: FULL },
}

export const sheetParam = ({ results, detent }: SheetState): SheetParam | undefined =>
  SHEET_PARAMS.find((p) => SHEETS[p].results === results && SHEETS[p].detent === detent)

export type ViewParam = 'map' | 'split' | 'table' | undefined

// A desktop link's split or table view opens as a results table on a phone.
export function sheetFromUrl(sheet: SheetParam | undefined, view: ViewParam): SheetState {
  if (sheet) return SHEETS[sheet]
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
