import GenericMapContainer from '@/components/maps/generic-map-container';
import { MapShell } from '@/components/maps/map-shell'
import { useRef } from 'react';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox';
import { parquetUrl } from '@/lib/constants';
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
      type: 'parquet',
      parquetUrl: parquetUrl('hazards_qfaults'),
      layerName: qFaultsWMSTitle,
      sourceName: 'Faults',
      // `concatnames` was assembled by the search_fault_data RPC from these four columns.
      // All four are needed: 195 faults carry only `faultname`, and 15 more name something
      // the zone/section/strand parts don't (Utah Lake faults → "Saratoga Springs main
      // fault"). Unlike the RPC this drops empties and the literal '<Null>', so labels come
      // out clean rather than as " - Cross Hollow Hills faults -  - ".
      derivedFields: {
        concatnames: `array_to_string(list_filter([faultzone, faultname, sectionname, strandname], x -> x IS NOT NULL AND trim(x) <> '' AND trim(x) <> '<Null>'), ' - ')`,
      },
      displayField: 'concatnames',
      // Keyed on the assembled name, not `faultnum`: one fault number covers every section
      // and strand of a zone (229 numbers over 19,743 rows), so picking "Wasatch fault zone -
      // Brigham City section" would otherwise highlight the entire zone.
      idField: 'concatnames',
      params: { targetFields: ['concatnames'] },
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