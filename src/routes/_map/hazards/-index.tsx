import GenericMapContainer from '@/components/maps/generic-map-container';
import { MapShell } from '@/components/maps/map-shell'
import { useRef } from 'react';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { qFaultsWMSTitle } from './-data/layers/layers';
import { useMapContextState } from '@/hooks/use-map-context-state';
import { MapContext } from '@/context/map-context';
import { TourAutoStart } from '@/components/tour-auto-start';

export default function Map() {
  const { contextValue } = useMapContextState();
  const searchRef = useRef<SearchComboboxHandle>(null);

  const searchConfig: SearchSourceConfig[] = [
    defaultMasqueradeConfig,
    {
      type: 'postgREST',
      url: PROD_POSTGREST_URL,
      functionName: "search_fault_data",
      layerName: qFaultsWMSTitle,
      searchTerm: "search_term",
      sourceName: 'Faults',
      displayField: "concatnames",
      params: { select: 'concatnames' }, // Exclude geometry from search for fast response
      headers: {
        'Accept-Profile': 'hazards',
      }
    },
  ];

  return (
    <MapContext.Provider value={contextValue}>
      <TourAutoStart route="hazards" />
      <MapShell
        search={
            <SearchCombobox
            ref={searchRef}
            config={searchConfig}
            onFeatureSelect={handleSearchSelect}
            onCollectionSelect={handleCollectionSelect}
            className="w-full"
            />
        }
      >
        <GenericMapContainer
        onClearSearch={() => searchRef.current?.clear()}
        disableExport
        />
      </MapShell>
    </MapContext.Provider>
  )
}