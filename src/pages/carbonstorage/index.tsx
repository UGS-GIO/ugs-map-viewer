import { useSearch } from '@tanstack/react-router';
import { Layout } from '@/components/custom/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/custom/map/map-footer'
import { cn } from '@/lib/utils'
import MapContainer from './components/map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useLayerUrl } from '@/context/layer-url-provider'
import { PROD_POSTGREST_URL } from '@/lib/constants'
import { wellWithTopsLayerName, wellWithTopsWMSTitle } from '@/pages/carbonstorage/data/layers/layers'
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox'

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const sidebarMargin = isCollapsed ? 56 : sidebarWidthPx;
  const search = useSearch({ from: '/_map/carbonstorage/' });
  const { updateLayerSelection } = useLayerUrl();

  const searchConfig: SearchSourceConfig[] = [
    defaultMasqueradeConfig,
    {
      type: 'postgREST',
      url: `${PROD_POSTGREST_URL}/${wellWithTopsLayerName}`,
      sourceName: 'API #',
      crs: 'EPSG:26912',
      displayField: 'api',
      layerName: wellWithTopsWMSTitle,
      params: {
        select: 'shape,api',
        targetField: 'api',
      },
      headers: {
        'Accept': 'application/geo+json',
        'Content-Type': 'application/json',
        'Accept-Profile': 'emp',
      },
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
          {/* ===== Top Heading ===== */}
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

          {/* ===== Main ===== */}
          <Layout.Body>
            <MapContainer
              searchParams={search}
              updateLayerSelection={updateLayerSelection}
            />
          </Layout.Body>

          {/* ===== Footer ===== */}
          <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />
        </Layout>
      </main>
    </div>
  )
}