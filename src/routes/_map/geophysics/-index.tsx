import { useMemo, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useLayerUrl } from '@/context/layer-url-provider'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect } from '@/components/sidebar/filter/search-combobox';
import { geothermalTEMLayerTitle, gravityStationsLayeTitle, powerplantsTitle } from './-data/layers/layers';
import { powerplantsFilterSchema } from './-data/layers/powerplants-schema'
import { toMaplibreFilter } from '@/lib/filter/generators'
import { fromCql } from '@/lib/filter/parse'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'

export default function Map() {
    const { updateLayerSelection } = useLayerUrl();
    const { contextValue } = useMapContextState();

    // Get URL filters
    const searchParams = useSearch({ from: '/_map/geophysics/' })
    const filtersFromUrl = searchParams.filters ?? {}

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
        if (filtersFromUrl[powerplantsFilterSchema.recordKey]) updateLayerSelection(powerplantsTitle, true)
    }, [filtersFromUrl, updateLayerSelection])

    const searchConfig: SearchSourceConfig[] = [
        defaultMasqueradeConfig,
        {
            type: 'postgREST',
            url: PROD_POSTGREST_URL,
            functionName: 'search_geophysics_tem',
            searchTerm: 'search_term',
            sourceName: 'TEM Data',
            layerName: geothermalTEMLayerTitle,
            displayField: 'station',
            params: { select: 'station,project,unique_id,geom' },
            headers: { 'Accept-Profile': 'emp', 'Accept': 'application/geo+json' },
        },
        {
            type: 'postgREST',
            url: PROD_POSTGREST_URL,
            functionName: 'search_geophysics_ugsgravity',
            searchTerm: 'search_term',
            sourceName: 'Gravity Stations',
            layerName: gravityStationsLayeTitle,
            displayField: 'unique_id',
            params: { select: 'unique_id,station,project,geom' },
            headers: { 'Accept-Profile': 'emp', 'Accept': 'application/geo+json' },
        },
    ];

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <MapShell
        search={
            <SearchCombobox
            config={searchConfig}
            onFeatureSelect={handleSearchSelect}
            onCollectionSelect={handleCollectionSelect}
            className="w-full"
            />
        }
      >
        <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
      </MapShell>
    </MapContext.Provider>
    )
}