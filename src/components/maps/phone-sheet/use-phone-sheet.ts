import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  applyStep,
  FULL,
  openPanelStep,
  PANEL_PEEK,
  PEEK,
  raise,
  sheetFromUrl,
  tapTab as nextOnTap,
  type Detent,
  type InfoDetail,
  type PhoneTab,
  type ResultsView,
  type Step,
} from './sheet-model'

/**
 * Moves the phone sheet without subscribing to it, for callers that only act (zoom, a filter).
 * The sheet moves do nothing on desktop, so callers needn't check for a phone.
 */
export function usePhoneSheetActions() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Every write replaces: map position, layers and settings live in the URL too, so a pushed entry
  // would let Back restore an older URL and undo them.
  const go = useCallback((step: Step) => {
    if (isMobile) navigate({ to: '.', replace: true, search: (prev) => applyStep(prev, step) })
  }, [navigate, isMobile])

  const openDetail = useCallback((detail: InfoDetail | null) => {
    navigate({ to: '.', replace: true, search: (prev) => ({ ...prev, detail: detail ?? undefined }) })
  }, [navigate])

  return useMemo(() => ({
    tapTab: (t: PhoneTab) => go((cur, tb) => nextOnTap(cur, tb, t)),
    setDetent: (d: Detent) => go((cur) => ({ sheet: { ...cur, detent: d } })),
    openPanel: (tab: string) => go(openPanelStep(tab)),
    openDetail,
    showResults: (as: ResultsView) => go((cur) => ({ sheet: { results: as, detent: as === 'table' ? FULL : raise(cur.detent) } })),
    // A new selection keeps the view the user chose while Results is open.
    raiseResults: (fallback: ResultsView) => go((cur) => ({ sheet: { results: cur.results ?? fallback, detent: raise(cur.detent) } })),
    setResultsView: (as: ResultsView) => go((cur) => ({ sheet: { ...cur, results: as } })),
    peek: () => go((cur) => ({ sheet: { ...cur, detent: PEEK } })),
    closeResults: () => go(() => ({ sheet: PANEL_PEEK })),
  }), [go, openDetail])
}

/** The phone sheet's state in the URL (`sheet`, `detail`, and the shared `tab`), plus its actions. */
export function usePhoneSheet() {
  const sheet = useSearch({ from: '/_map', select: (s) => s.sheet })
  const results = useSearch({ from: '/_map', select: (s) => s.results })
  const view = useSearch({ from: '/_map', select: (s) => s.view })
  const tab = useSearch({ from: '/_map', select: (s) => s.tab ?? 'info' })
  const detail = useSearch({ from: '/_map', select: (s) => s.detail ?? null })
  const actions = usePhoneSheetActions()
  return { ...actions, state: sheetFromUrl({ sheet, results, view }), tab, detail }
}
