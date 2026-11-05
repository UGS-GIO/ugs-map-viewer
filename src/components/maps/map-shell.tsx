import { AppBar } from '@/components/maps/app-bar'
import { MapFooterBar } from '@/components/maps/map-footer-bar'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { SIDEBAR_WIDTH_COLLAPSED } from '@/context/sidebar-provider'
import { cn } from '@/lib/utils'
import { usePresentation } from '@/hooks/use-presentation'

interface MapShellProps {
    /** Route-specific search control for the app bar. */
    search?: React.ReactNode
    /** Route-specific app-bar controls. */
    actions?: React.ReactNode
    /** The map itself. */
    children: React.ReactNode
}

const MapShell = ({ search, actions, children }: MapShellProps) => {
    const { isCollapsed, sidebarWidthPx } = useSidebar()
    const isMobile = useIsMobile()
    // A presentation is the map alone, with its stops in a bar over it
    const { presenting } = usePresentation()
    const showChrome = !presenting
    // Phones have no sidebar.
    const sidebarWidth = isMobile || presenting ? 0 : isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : sidebarWidthPx

    // The shell is fixed chrome and must never scroll: overflow-clip keeps it non-scrollable even
    // to focus()/scrollIntoView (e.g. focusing a below-fold filter radio), which would otherwise
    // jerk the whole shell and strand the footer. The minmax(0,1fr) column stops a long app-bar
    // title from widening the grid past the viewport and pushing the map's right edge off-screen.
    return (
        <div className={cn('grid h-full grid-cols-[minmax(0,1fr)] overflow-clip bg-background', showChrome ? 'grid-rows-[auto_1fr_auto]' : 'grid-rows-[minmax(0,1fr)]')}>
            <a
                href="#content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
            >
                Skip to map
            </a>
            {showChrome && <AppBar search={isMobile ? undefined : search} actions={actions} />}
            <div className="relative min-h-0 min-w-0 overflow-hidden">
                {/* Phones put every panel in the map's sheet, and have no room for the footer bar. */}
                {!isMobile && showChrome && <Sidebar />}
                {/* isolate: the map's own overlays stack inside main, below the app chrome. */}
                <main
                    id="content"
                    tabIndex={-1}
                    aria-label="Map"
                    data-presenting={presenting || undefined}
                    className="relative isolate h-full min-w-0 overflow-hidden transition-[margin] duration-200 ease-linear"
                    style={{ marginLeft: `${sidebarWidth}px` }}
                >
                    {children}
                </main>
            </div>
            {!isMobile && showChrome && <MapFooterBar />}
        </div>
    )
}

export { MapShell }
