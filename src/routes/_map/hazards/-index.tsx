import { Layout } from '@/components/layout/layout';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/maps/map-footer';
import { cn } from '@/lib/utils';
import GenericMapContainer from '@/components/maps/generic-map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { qFaultsWMSTitle } from './-data/layers/layers';
import { useMapContextState } from '@/hooks/use-map-context-state';
import { MapContext } from '@/context/map-context';

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const { handleMapReady, contextValue, drawMode, setDrawMode, handleDrawComplete, setClearSpatialFilterCallback } = useMapContextState();
  // Use 56px (3.5rem) when collapsed, dynamic pixel width when expanded
  // On mobile, no margin needed (sidebar is top, not left)
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);

  const searchConfig: SearchSourceConfig[] = [
    defaultMasqueradeConfig,
    {
      type: 'postgREST',
      url: PROD_POSTGREST_URL,
      functionName: "search_fault_data",
      layerName: qFaultsWMSTitle,
      searchTerm: "search_term",
      sourceName: 'Faults',
      crs: 'EPSG:4326',
      displayField: "concatnames",
      params: { select: 'concatnames' }, // Exclude geometry from search for fast response
      headers: {
        'Accept-Profile': 'hazards',
      }
    },
  ];

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
            <Layout.Header className='hidden md:flex items-center justify-between px-4 md:px-6'>
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

            {/* ===== Map ===== */}
            <Layout.Body>
              <GenericMapContainer
                popupTitle="Hazards in your area"
                onMapReady={handleMapReady}
                skipContextProvider
                externalDrawMode={drawMode}
                onExternalDrawModeChange={setDrawMode}
                onExternalDrawComplete={handleDrawComplete}
                onRegisterClearSpatialFilter={setClearSpatialFilterCallback}
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