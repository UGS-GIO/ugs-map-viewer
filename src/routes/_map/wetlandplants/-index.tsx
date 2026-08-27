import { useMemo } from 'react'
import type { FilterSpecification } from 'maplibre-gl'
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
import { TourAutoStart } from '@/components/tour-auto-start'
import { wetlandSurveySitesTitle } from './-data/layers/layers'

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
    const { contextValue } = useMapContextState();

    // PRIVACY: the warehouse does not yet offset Confidential wetland survey site
    // coordinates (see comment in -data/layers/layers.tsx — re-verified for ALL-5753 that
    // ALL-5709's fix was never actually shipped despite being marked Done). Hide those
    // features entirely from the true-coordinate PMTiles layer rather than render their real
    // location; `confidentialSitesConfig` (ALL-5753) shows them separately at a client-side
    // jittered approximate location instead. Do not remove this filter without confirming the
    // warehouse pipeline now jitters confidential geometries.
    const vectorLayerFilters = useMemo<Record<string, FilterSpecification>>(() => ({
        [wetlandSurveySitesTitle]: ['!=', ['get', 'privacystatus'], 'Confidential'],
    }), []);

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
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
                            <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
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
