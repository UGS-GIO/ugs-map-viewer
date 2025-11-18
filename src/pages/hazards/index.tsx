import { Layout } from '@/components/custom/layout';
import ThemeSwitch from '@/components/theme-switch';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/custom/map/map-footer';
import { cn } from '@/lib/utils';
import MapContainer from './components/map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, handleSuggestionSelect } from '@/components/sidebar/filter/search-combobox';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { qFaultsWMSTitle } from '@/pages/hazards/data/layers/layers';
import { SIDEBAR_MARGINS } from '@/lib/sidebar-constants';

export default function Map() {
  const { isCollapsed, sidebarWidth } = useSidebar();
  const marginClass = isCollapsed ? SIDEBAR_MARGINS.icon : SIDEBAR_MARGINS[sidebarWidth];

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
      displayField: "concatnames", // Field in PostgREST result features
      headers: {
        'Accept-Profile': 'hazards',
        'Accept': 'application/geo+json',
      }
    },
  ];

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <Sidebar />
      <main
        id="content"
        className={`overflow-x-hidden pt-16 transition-[margin] md:overflow-y-hidden md:pt-0 ${marginClass} h-full`}
      >
        <Layout>
          <Layout.Header className='flex items-center justify-between px-4 md:px-6'>
            <TopNav className="hidden md:block md:w-auto" />
            <div className='flex items-center flex-1 min-w-0 md:flex-initial md:w-1/3 md:ml-auto space-x-2'>
              <div className="flex-1 min-w-0">
                <SearchCombobox
                  config={searchConfig}
                  onFeatureSelect={handleSearchSelect}
                  onCollectionSelect={handleCollectionSelect}
                  onSuggestionSelect={handleSuggestionSelect}
                  className="w-full"
                />
              </div>
              <div className="flex-shrink-0">
                <ThemeSwitch />
              </div>
            </div>
          </Layout.Header>

          {/* ===== Map ===== */}
          <Layout.Body>
            <MapContainer />
          </Layout.Body>

          {/* ===== Footer ===== */}
          {/* no footer on mobile */}
          <Layout.Footer className={cn('hidden md:flex z-10')} dynamicContent={<MapFooter />} />
        </Layout>
      </main>
    </div>
  )
}