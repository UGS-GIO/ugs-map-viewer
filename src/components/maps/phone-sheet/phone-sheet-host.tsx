import type { ReactNode, RefObject } from 'react'
import { CurrentPanel } from '@/components/sidebar/current-panel'
import { Spinner } from '@/components/ui/loading-spinner'
import { useSidebar } from '@/hooks/use-sidebar'
import { useGetSidebarLinks } from '@/hooks/use-get-sidebar-links'
import { useGetCurrentPage } from '@/hooks/use-get-current-page'
import { activeTabOf, INFO_DETAIL_TITLE, MORE_TAB } from './sheet-model'
import { PhoneSheet } from './phone-sheet'
import { ResultsViewToggle } from './results-view-toggle'
import { MoreList } from './more-list'
import { usePhoneSheet } from './use-phone-sheet'

interface PhoneSheetHostProps {
  container: RefObject<HTMLElement | null>
  results: ReactNode
  resultsSummary?: string
  layersSummary?: string
}

/** Puts the route's panels, the More list and the results into the phone sheet. */
export function PhoneSheetHost({ container, results, resultsSummary, layersSummary }: PhoneSheetHostProps) {
  const sheet = usePhoneSheet()
  const { currentContent } = useSidebar()
  const { data: links = [], isSuccess: linksLoaded, isError: linksFailed } = useGetSidebarLinks()
  const page = useGetCurrentPage()
  const active = activeTabOf(sheet.state, sheet.tab)
  const Panel = currentContent?.component
  const wantsPanel = active !== 'results' && sheet.tab !== MORE_TAB
  const missingPanel = wantsPanel && !Panel && (linksLoaded || linksFailed)
  const detail = active === 'info' ? sheet.detail : null

  let title: string
  let summary: string | undefined
  let headerAction: ReactNode
  let back: { label: string; onClick: () => void } | undefined
  let body: ReactNode
  if (active === 'results') {
    title = 'Results'
    summary = resultsSummary
    // Only once there are results to switch between.
    if (resultsSummary) headerAction = <ResultsViewToggle value={sheet.state.results ?? 'cards'} onChange={sheet.setResultsView} />
    body = results
  } else if (wantsPanel && Panel && currentContent) {
    title = detail ? INFO_DETAIL_TITLE[detail] : currentContent.title
    summary = active === 'layers' ? layersSummary : undefined
    if (detail) back = { label: 'Info', onClick: () => sheet.openDetail(null) }
    else if (active === 'more') back = { label: 'More', onClick: () => sheet.openPanel(MORE_TAB) }
    body = <CurrentPanel />
  } else if (wantsPanel && !missingPanel) {
    title = ''
    body = <Spinner />
  } else {
    title = 'More'
    body = <MoreList links={links} page={page} onOpen={sheet.openPanel} />
  }

  return (
    <PhoneSheet
      container={container}
      detent={sheet.state.detent}
      activeTab={active}
      panelKey={`${active}:${sheet.tab}:${detail ?? ''}`}
      title={title}
      summary={summary}
      headerAction={headerAction}
      back={back}
      onSelectTab={sheet.tapTab}
      onSetDetent={sheet.setDetent}
    >
      {body}
    </PhoneSheet>
  )
}
