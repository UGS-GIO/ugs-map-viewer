import { useMemo, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Layout } from '@/components/layout/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/maps/map-footer'
import { cn } from '@/lib/utils'
import GenericMapContainer from '@/components/maps/generic-map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useLayerUrl } from '@/context/layer-url-provider'
import { wellWithTopsWMSTitle } from './-data/layers/layers'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox'
import { PROD_POSTGREST_URL } from '@/lib/constants'

// Carbon Storage specific filter mapping
const CCS_FILTER_MAPPING: Record<string, string> = {
  [wellWithTopsWMSTitle]: wellWithTopsWMSTitle,
}

const searchConfig: SearchSourceConfig[] = [
  defaultMasqueradeConfig,
  {
    type: 'postgREST',
    url: PROD_POSTGREST_URL,
    functionName: "search_geologic_units",
    searchTerm: "search_term",
    sourceName: 'Geologic Units',
    crs: 'EPSG:4326',
    displayField: "unit_label",
    params: { select: 'unit_label' },
    headers: {
      'Accept-Profile': 'mapping',
    }
  },
]

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
  const { selectedLayerTitles, updateLayerSelection } = useLayerUrl()
  const { handleMapReady, contextValue, setClearSpatialFilterCallback, setLayerTurnedOffCallback } = useMapContextState();

  // Get URL filters
  const searchParams = useSearch({ from: '/_map/carbonstorage/' })
  const filtersFromUrl = searchParams.filters ?? {}

  // Build CQL filters for layers
  const layerFilters = useMemo(() => {
    const filters: Record<string, string> = {}
    for (const [filterKey, layerTitle] of Object.entries(CCS_FILTER_MAPPING)) {
      const filterValue = filtersFromUrl[filterKey]
      if (filterValue) {
        filters[layerTitle] = filterValue
      }
    }
    return filters
  }, [filtersFromUrl])

  // Auto-select layer when filter is applied
  useEffect(() => {
    for (const [filterKey, layerTitle] of Object.entries(CCS_FILTER_MAPPING)) {
      const filterValue = filtersFromUrl[filterKey]
      if (filterValue && !selectedLayerTitles.has(layerTitle)) {
        updateLayerSelection(layerTitle, true)
      }
    }
  }, [filtersFromUrl, selectedLayerTitles, updateLayerSelection])

  return (
    <MapContext.Provider value={contextValue}>
      <TourAutoStart route="ccs" />
      <div className="relative h-svh overflow-hidden bg-background">
        <Sidebar />
        <main
          id="content"
          className="overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full"
          style={{ marginLeft: `${sidebarMargin}px` }}
        >
          <Layout>
            {/* ===== Top Heading ===== */}
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

            {/* ===== Main ===== */}
            <Layout.Body>
              <GenericMapContainer
                popupTitle="CCS Information"
                layerFilters={layerFilters}
                onMapReady={handleMapReady}
                skipContextProvider
                onRegisterClearSpatialFilter={setClearSpatialFilterCallback}
                onRegisterLayerTurnedOff={setLayerTurnedOffCallback}
              />
            </Layout.Body>

            {/* ===== Footer ===== */}
            <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />
          </Layout>
        </main>
      </div>
    </MapContext.Provider>
  )
}
