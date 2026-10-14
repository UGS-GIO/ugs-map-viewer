import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  FULL,
  PANEL_PEEK,
  PEEK,
  raise,
  sheetFromUrl,
  tapTab as nextOnTap,
  writeSheet,
  type Detent,
  type InfoDetail,
  type PhoneTab,
  type ResultsView,
  type SheetState,
} from './sheet-model'

type Step = (cur: SheetState, tab: string) => { sheet: SheetState; tab?: string }

/** Moves the phone sheet without subscribing to it, for callers that only act (zoom, a filter). */
export function usePhoneSheetActions() {
  const navigate = useNavigate()

  // Every write replaces: map position, layers and settings live in the URL too, so a pushed entry
  // would let Back restore an older URL and undo them. Each step reads the URL it is applied to, so
  // a raise queued behind another navigation (a map tap's requestAnimationFrame) is never stale.
  const go = useCallback((step: Step) => {
    navigate({
      to: '.',
      replace: true,
      search: (prev) => {
        const next = step(sheetFromUrl(prev.sheet, prev.view), prev.tab ?? 'info')
        return writeSheet(prev, next.sheet, next.tab)
      },
    })
  }, [navigate])

  const openDetail = useCallback((detail: InfoDetail | null) => {
    navigate({ to: '.', replace: true, search: (prev) => ({ ...prev, detail: detail ?? undefined, view: undefined }) })
  }, [navigate])

  return useMemo(() => ({
    tapTab: (t: PhoneTab) => go((cur, tb) => nextOnTap(cur, tb, t)),
    setDetent: (d: Detent) => go((cur) => ({ sheet: { ...cur, detent: d } })),
    openPanel: (tab: string) => go((cur) => ({ sheet: { results: null, detent: raise(cur.detent) }, tab })),
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
  const view = useSearch({ from: '/_map', select: (s) => s.view })
  const tab = useSearch({ from: '/_map', select: (s) => s.tab ?? 'info' })
  const detail = useSearch({ from: '/_map', select: (s) => s.detail ?? null })
  const actions = usePhoneSheetActions()
  return { ...actions, state: sheetFromUrl(sheet, view), tab, detail }
}
