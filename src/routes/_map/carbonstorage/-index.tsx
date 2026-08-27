import { useMemo, useEffect, useRef } from 'react'
import { useSearch } from '@tanstack/react-router'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useLayerUrl } from '@/context/layer-url-provider'
import { wellWithTopsWMSTitle, seamlessGeolunitsWMSTitle, utTownshipRangesTitle, powerplantsTitle } from './-data/layers/layers'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox'
import { PROD_POSTGREST_URL } from '@/lib/constants'
import { powerplantsFilterSchema } from './-data/layers/powerplants-schema'
import { toMaplibreFilter } from '@/lib/filter/generators'
import { fromCql } from '@/lib/filter/parse'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'

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
  const { updateLayerSelection } = useLayerUrl()
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

  // Translate Power Plants' stored CQL filter (from its checkbox legend) into a maplibre
  // filter expression for the PMTiles layer.
  const vectorLayerFilters = useMemo(() => {
    const powerplantsCql = filtersFromUrl[powerplantsFilterSchema.recordKey]
    const result: Record<string, FilterSpecification> = {}
    if (powerplantsCql) {
      const expr: ExpressionSpecification | null = toMaplibreFilter(powerplantsFilterSchema, fromCql(powerplantsFilterSchema, powerplantsCql))
      if (expr) result[powerplantsTitle] = expr
    }
    return result
  }, [filtersFromUrl])

  // A filtered layer must be on screen (selection reveals its groups too).
  useEffect(() => {
    for (const [filterKey, layerTitle] of Object.entries(CCS_FILTER_MAPPING)) {
      if (filtersFromUrl[filterKey]) updateLayerSelection(layerTitle, true)
    }
    if (filtersFromUrl[powerplantsFilterSchema.recordKey]) updateLayerSelection(powerplantsTitle, true)
  }, [filtersFromUrl, updateLayerSelection])

  const onFeatureSelect = handleSearchSelect
  const onCollectionSelect = handleCollectionSelect

  return (
    <MapContext.Provider value={contextValue}>
      <TourAutoStart route="ccs" />
      <MapShell
        search={
            <SearchCombobox
            ref={searchRef}
            config={searchConfig}
            onFeatureSelect={onFeatureSelect}
            onCollectionSelect={onCollectionSelect}
            className="w-full"
            />
        }
      >
        <GenericMapContainer
        layerFilters={layerFilters}
        vectorLayerFilters={vectorLayerFilters}
        onClearSearch={() => searchRef.current?.clear()}
        />
      </MapShell>
    </MapContext.Provider>
  )
}
