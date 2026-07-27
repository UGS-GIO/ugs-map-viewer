import { useMemo, useEffect, useCallback, useRef } from 'react'
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
import { wellWithTopsWMSTitle, seamlessGeolunitsWMSTitle, utTownshipRangesTitle } from './-data/layers/layers'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox'
import { PROD_POSTGREST_URL } from '@/lib/constants'

// Carbon Storage specific filter mapping
const CCS_FILTER_MAPPING: Record<string, string> = {
  [wellWithTopsWMSTitle]: wellWithTopsWMSTitle,
}

const searchConfig: SearchSourceConfig[] = [
  defaultMasqueradeConfig,
  {
    type: 'postgREST',
    url: `${PROD_POSTGREST_URL}/wellswithtops_hascore`,
    sourceName: 'Wells Database',
    layerName: wellWithTopsWMSTitle,
    displayField: 'api',
    secondaryDisplayField: 'wellname',
    params: {
      targetFields: ['api', 'wellname'],
      select: 'api,wellname,shape',
    },
    headers: {
      'Accept-Profile': 'emp',
      'Accept': 'application/geo+json',
    },
  },
  {
    type: 'postgREST',
    url: `${PROD_POSTGREST_URL}/enmin_plss_townshiprange_current`,
    sourceName: 'Utah Township & Ranges',
    layerName: utTownshipRangesTitle,
    displayField: 'twnshplab',
    secondaryDisplayField: 'label',
    params: {
      targetFields: ['twnshplab', 'label'],
      select: 'twnshplab,label,geom',
    },
    headers: {
      'Accept-Profile': 'emp',
      'Accept': 'application/geo+json',
    },
  },
  {
    type: 'postgREST',
    url: PROD_POSTGREST_URL,
    functionName: "search_geologic_units",
    searchTerm: "search_term",
    functionParams: { search_scale: 'small' },
    sourceName: 'Geologic Units',
    layerName: seamlessGeolunitsWMSTitle,
    displayField: "unit_label",
    params: { select: 'unit_label,match_type' },
    groupByField: 'match_type',
    groupLabels: {
      name: 'Name Matches',
      symbol: 'Symbol Matches',
      description: 'Description Matches',
    },
    headers: {
      'Accept-Profile': 'mapping',
    }
  },
]

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
  const { selectedLayerTitles, updateLayerSelection, setGroupVisibility, groupVisibility } = useLayerUrl()
  const { contextValue } = useMapContextState();
  const searchRef = useRef<SearchComboboxHandle>(null);

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

  // Map child layers to their parent group for auto-visibility
  const LAYER_PARENT_GROUP: Record<string, string> = {
    [seamlessGeolunitsWMSTitle]: 'Geological Information',
    [wellWithTopsWMSTitle]: 'Subsurface Data',
  }

  // Auto-select the associated layer and its parent group when a search result is picked
  const ensureLayerSelected = useCallback(
    (sourceIndex: number, configs: SearchSourceConfig[]) => {
      const src = configs[sourceIndex]
      const layerName = src?.type === 'postgREST' ? src.layerName : undefined
      if (layerName && !selectedLayerTitles.has(layerName)) {
        updateLayerSelection(layerName, true)
      }
      const parentGroup = layerName ? LAYER_PARENT_GROUP[layerName] : undefined
      if (parentGroup && !groupVisibility.get(parentGroup)) {
        setGroupVisibility(parentGroup, true)
      }
    },
    [selectedLayerTitles, updateLayerSelection, groupVisibility, setGroupVisibility]
  )

  const onFeatureSelect: typeof handleSearchSelect = useCallback(
    (...args) => { ensureLayerSelected(args[2], args[3]); handleSearchSelect(...args) },
    [ensureLayerSelected]
  )

  const onCollectionSelect: typeof handleCollectionSelect = useCallback(
    (...args) => { ensureLayerSelected(args[2], args[3]); handleCollectionSelect(...args) },
    [ensureLayerSelected]
  )

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
                    ref={searchRef}
                    config={searchConfig}
                    onFeatureSelect={onFeatureSelect}
                    onCollectionSelect={onCollectionSelect}
                    className="w-full"
                  />
                </div>
              </div>
            </Layout.Header>

            {/* ===== Main ===== */}
            <Layout.Body>
              <GenericMapContainer
                layerFilters={layerFilters}
                onClearSearch={() => searchRef.current?.clear()}
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
