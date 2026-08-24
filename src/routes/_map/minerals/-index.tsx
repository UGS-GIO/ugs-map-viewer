import { Layout } from '@/components/layout/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooterBar } from '@/components/maps/map-footer-bar'
import GenericMapContainer from '@/components/maps/generic-map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
    const { contextValue } = useMapContextState();

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <div className="relative flex h-full flex-col overflow-hidden bg-background">
                <div className="relative flex-1 min-h-0">
                    <Sidebar />
                <main
                    id="content"
                    className="overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full"
                    style={{ marginLeft: `${sidebarMargin}px` }}
                >
                    <Layout>

                        {/* ===== Top Heading ===== */}
                        <Layout.Header className='hidden md:flex'>
                            <TopNav />
                            <div className='ml-auto flex items-center space-x-4'>
                                {/* <SearchCombobox /> goes here */}
                            </div>
                        </Layout.Header>

                        {/* ===== Main ===== */}
                        <Layout.Body>
                            <GenericMapContainer />
                        </Layout.Body>

                    </Layout>
                </main>
                </div>
                <MapFooterBar />
            </div>
        </MapContext.Provider>
    )
}
