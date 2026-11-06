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
import { usePresentation } from '@/hooks/use-presentation'
import { PresentationNav } from '@/components/maps/presentation-bar'
import { stopLetter } from '@/lib/map/shared-stops'

interface PhoneSheetHostProps {
  container: RefObject<HTMLElement | null>
  results: ReactNode
  /** Clears the selection behind the results and drops the sheet, as the desktop panel's ✕ does. */
  onClearResults: () => void
  resultsSummary?: string
  layersSummary?: string
}

/** Puts the route's panels, the More list and the results into the phone sheet. */
export function PhoneSheetHost({ container, results, onClearResults, resultsSummary, layersSummary }: PhoneSheetHostProps) {
  const sheet = usePhoneSheet()
  const { currentContent } = useSidebar()
  const { data: links = [], isSuccess: linksLoaded, isError: linksFailed } = useGetSidebarLinks()
  const page = useGetCurrentPage()
  const active = activeTabOf(sheet.state, sheet.tab)
  const Panel = currentContent?.component
  const wantsPanel = active !== 'results' && sheet.tab !== MORE_TAB
  const missingPanel = wantsPanel && !Panel && (linksLoaded || linksFailed)
  const detail = active === 'info' ? sheet.detail : null
  const presentation = usePresentation()

  let title: string
  let summary: string | undefined
  let headerAction: ReactNode
  let back: { label: string; onClick: () => void } | undefined
  let clear: { label: string; onClick: () => void } | undefined
  let controls: ReactNode
  let body: ReactNode
  let panelKey = `${active}:${sheet.tab}:${detail ?? ''}`
  if (presentation.presenting) {
    // The stop is the sheet: its title and buttons at the peek, its note and any selected features above
    const { index, stops } = presentation
    title = `${stopLetter(index)}. ${stops[index].label}`
    controls = <PresentationNav />
    panelKey = `present:${index}`
    body = (
      <>
        {/* The header truncates, so the whole label leads */}
        <p className='pb-1 text-sm text-muted-foreground'>{index + 1} of {stops.length}</p>
        <p className='pb-2 text-base font-medium'>{stops[index].label}</p>
        {stops[index].note && <p className='whitespace-pre-line pb-3 text-base'>{stops[index].note}</p>}
        {resultsSummary && results}
      </>
    )
  } else if (active === 'results') {
    title = 'Results'
    summary = resultsSummary
    // Only once there are results to switch between.
    if (resultsSummary) {
      headerAction = <ResultsViewToggle value={sheet.state.results ?? 'cards'} onChange={sheet.setResultsView} />
      clear = { label: 'Clear selection', onClick: onClearResults }
    }
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
      panelKey={panelKey}
      title={title}
      summary={summary}
      headerAction={headerAction}
      controls={controls}
      back={back}
      clear={clear}
      onSelectTab={sheet.tapTab}
      onSetDetent={sheet.setDetent}
    >
      {body}
    </PhoneSheet>
  )
}
