import { Layout } from '@/components/layout/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/maps/map-footer'
import { cn } from '@/lib/utils'
import GenericMapContainer from '@/components/maps/generic-map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
    const { handleMapReady, contextValue, setClearSpatialFilterCallback, setLayerTurnedOffCallback } = useMapContextState();

    return (
        <MapContext.Provider value={contextValue}>
            <div className="relative h-svh overflow-hidden bg-background">
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
                                {/* Search Combobox goes here */}
                            </div>
                        </Layout.Header>

                        {/* ===== Main ===== */}
                        <Layout.Body>
                            <GenericMapContainer
                                popupTitle="Geophysical Features"
                                onMapReady={handleMapReady}
                                skipContextProvider
                                onRegisterClearSpatialFilter={setClearSpatialFilterCallback}
                                onRegisterLayerTurnedOff={setLayerTurnedOffCallback}
                            />
                        </Layout.Body>

                        {/* ===== Footer ===== */}
                        {/* no footer on mobile */}
                        <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />

                    </Layout>
                </main>
            </div>
        </MapContext.Provider>
    )
}
