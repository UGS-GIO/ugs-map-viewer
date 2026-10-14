import { Suspense, useEffect, type ReactNode } from 'react'
import { Spinner } from '@/components/ui/loading-spinner'
import { useSidebar } from '@/hooks/use-sidebar'
import { useGetSidebarLinks } from '@/hooks/use-get-sidebar-links'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { activeTabOf, INFO_DETAIL_TITLE, MORE_TAB } from './sheet-model'
import { PhoneSheet } from './phone-sheet'
import { MoreList } from './more-list'
import { usePhoneSheet } from './use-phone-sheet'

interface PhoneSheetHostProps {
  map: ReactNode
  results: ReactNode
  resultsSummary?: string
  layersSummary?: string
  /** Absent when there is nothing to clear, which hides the sheet's close button. */
  onClearResults?: () => void
}

/** Puts the route's panels, the More list and the results into the phone sheet. */
export function PhoneSheetHost({ map, results, resultsSummary, layersSummary, onClearResults }: PhoneSheetHostProps) {
  const sheet = usePhoneSheet()
  const { currentContent } = useSidebar()
  const { data: links = [], isSuccess: linksLoaded, isError: linksFailed, error: linksError } = useGetSidebarLinks()
  const page = useGetCurrentPage()
  const active = activeTabOf(sheet.state, sheet.tab)
  const Panel = currentContent?.component
  const wantsPanel = active !== 'results' && sheet.tab !== MORE_TAB
  const missingPanel = wantsPanel && !Panel && (linksLoaded || linksFailed)
  const detail = active === 'info' ? sheet.detail : null

  // One place reports bad URLs and missing panels, so a bad link warns once, not once per hook caller.
  useEffect(() => {
    if (sheet.invalid !== null) console.warn(`Ignoring sheet=${sheet.invalid} in the URL; the panel opens at its peek.`)
  }, [sheet.invalid])
  useEffect(() => {
    if (sheet.invalidDetail !== null) console.warn(`Ignoring detail=${sheet.invalidDetail} in the URL.`)
  }, [sheet.invalidDetail])
  useEffect(() => {
    if (linksFailed) console.warn(`Could not load the ${page} panels; the sheet shows only the tour and theme.`, linksError)
  }, [linksFailed, linksError, page])
  useEffect(() => {
    if (missingPanel && !linksFailed) console.warn(`No '${sheet.tab}' panel on ${page}; showing More instead.`)
  }, [missingPanel, linksFailed, sheet.tab, page])

  let title: string
  let summary: string | undefined
  let back: { label: string; onClick: () => void } | undefined
  let body: ReactNode
  if (active === 'results') {
    title = 'Results'
    summary = resultsSummary
    body = results
  } else if (wantsPanel && Panel && currentContent) {
    title = detail ? INFO_DETAIL_TITLE[detail] : currentContent.title
    summary = active === 'layers' ? layersSummary : undefined
    if (detail) back = { label: 'Info', onClick: () => sheet.openDetail(null) }
    else if (active === 'more') back = { label: 'More', onClick: () => sheet.openPanel(MORE_TAB) }
    body = (
      <Suspense fallback={<Spinner />}>
        <Panel />
      </Suspense>
    )
  } else if (wantsPanel && !missingPanel) {
    title = ''
    body = <Spinner />
  } else {
    title = 'More'
    body = <MoreList links={links} page={page} onOpen={sheet.openPanel} />
  }

  return (
    <PhoneSheet
      map={map}
      detent={sheet.state.detent}
      activeTab={active}
      panelKey={`${active}:${sheet.tab}:${detail ?? ''}`}
      title={title}
      summary={summary}
      back={back}
      onClose={active === 'results' ? onClearResults : undefined}
      closeLabel='Clear results'
      onSelectTab={sheet.tapTab}
      onSetDetent={sheet.setDetent}
    >
      {body}
    </PhoneSheet>
  )
}
