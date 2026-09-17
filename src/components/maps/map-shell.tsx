import { AppBar } from '@/components/maps/app-bar'
import { MapFooterBar } from '@/components/maps/map-footer-bar'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { SIDEBAR_WIDTH_COLLAPSED } from '@/context/sidebar-provider'

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
    // Mobile puts the sidebar over the map instead of beside it.
    const sidebarWidth = isMobile ? 0 : isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : sidebarWidthPx

    return (
        <div className="grid h-full grid-rows-[auto_1fr_auto] overflow-hidden bg-background">
            <a
                href="#content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
            >
                Skip to map
            </a>
            <AppBar search={search} actions={actions} />
            <div className="relative min-h-0">
                <Sidebar />
                <main
                    id="content"
                    tabIndex={-1}
                    aria-label="Map"
                    className="h-full overflow-hidden transition-[margin] duration-200 ease-linear"
                    style={{ marginLeft: `${sidebarWidth}px` }}
                >
                    {children}
                </main>
            </div>
            <MapFooterBar />
        </div>
    )
}

export { MapShell }
