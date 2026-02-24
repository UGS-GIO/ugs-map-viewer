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
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { geothermalTEMLayerTitle, gravityStationsLayerTitle } from './-data/layers/layers';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox';

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
    const { handleMapReady, contextValue, setClearSpatialFilterCallback, setLayerTurnedOffCallback } = useMapContextState();

    const searchConfig: SearchSourceConfig[] = [
        defaultMasqueradeConfig,
        {
          type: 'postgREST',
          url: PROD_POSTGREST_URL,
          functionName: "search_geothermal_thermal_data",
          layerName: geothermalTEMLayerTitle,
          searchTerm: "search_term",
          sourceName: 'Geothermal Thermal Data',
          crs: 'EPSG:4326',
          displayField: "concatnames",
          params: { select: 'concatnames' }, // Exclude geometry from search for fast response
          headers: {
            'Accept-Profile': 'emp',
             }
        },
        {
          type: 'postgREST',
          url: `${PROD_POSTGREST_URL}/enmin_geophysics_ugsgravity_current`,
          layerName: gravityStationsLayerTitle,
          sourceName: 'Modern Gravity Stations',
          crs: 'EPSG:4326',
          displayField: "unique_id",
          params: { 
            targetField: 'unique_id',
            select: 'unique_id,ogc_fid' 
          },
          headers: {
            'Accept-Profile': 'emp',
            'Accept': 'application/geo+json',
          }
        },
      ];

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
                            <div className='flex items-center flex-1 min-w-0 md:flex-initial md:w-1/3 md:ml-auto space-x-2'>
                                <div className="flex-1 min-w-0">
                                    <SearchCombobox
                                        config={searchConfig}
                                        onFeatureSelect={handleSearchSelect}
                                        onCollectionSelect={handleCollectionSelect}
                                        className="w-full"
                                    />
                                    </div>
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