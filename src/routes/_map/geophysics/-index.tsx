import { useMemo, useEffect } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Layout } from '@/components/layout/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooterBar } from '@/components/maps/map-footer-bar'
import GenericMapContainer from '@/components/maps/generic-map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
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
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
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
            <div className="relative flex h-full flex-col overflow-hidden bg-background">
                <div className="relative flex-1 min-h-0">
                    <Sidebar />
                <main
                    id="content"
                    className="overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full"
                    style={{ marginLeft: `${sidebarMargin}px` }}
                >
                    <Layout>

                        {/* ===== Top Heading ===== */}
                        <Layout.Header className='hidden md:flex'>
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
                            <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
                        </Layout.Body>

                    </Layout>
                </main>
                </div>
                <MapFooterBar />
            </div>
        </MapContext.Provider>
    )
}