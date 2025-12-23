import { Layout } from '@/components/custom/layout';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/custom/map/map-footer';
import { cn } from '@/lib/utils';
import MapContainer from './components/map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { qFaultsWMSTitle } from '@/pages/hazards/data/layers/layers';

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  // Use 56px (3.5rem) when collapsed, dynamic pixel width when expanded
  const sidebarMargin = isCollapsed ? 56 : sidebarWidthPx;

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
    <div className="relative h-full overflow-hidden bg-background">
      <Sidebar />
      <main
        id="content"
        className="overflow-x-hidden pt-16 transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full max-md:!ml-0"
        style={{ marginLeft: `${sidebarMargin}px` }}
      >
        <Layout>
          <Layout.Header className='flex items-center justify-between px-4 md:px-6'>
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
            <MapContainer />
          </Layout.Body>

          {/* ===== Footer ===== */}
          {/* no footer on mobile */}
          <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />
        </Layout>
      </main>
    </div>
  )
}