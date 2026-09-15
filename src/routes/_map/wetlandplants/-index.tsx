import { useMemo, useEffect } from 'react'
import type { FilterSpecification } from 'maplibre-gl'
import { useSearch } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Layout } from '@/components/layout/layout'
import { TopNav } from '@/components/top-nav'
import { MapFooter } from '@/components/maps/map-footer'
import { cn } from '@/lib/utils'
import GenericMapContainer from '@/components/maps/generic-map-container'
import Sidebar from '@/components/sidebar'
import { useSidebar } from '@/hooks/use-sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { useLayerUrl } from '@/context/layer-url-provider'
import { fromCql } from '@/lib/filter/parse'
import { toMaplibreFilter } from '@/lib/filter/generators'
import { wetlandSurveySitesTitle } from './-data/layers/layers'
import { wetlandPlantsFilterSchema } from './-data/layers/wetlandplants-schema'

export default function Map() {
    const { isCollapsed, sidebarWidthPx } = useSidebar();
    const isMobile = useIsMobile();
    const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);
    const { updateLayerSelection } = useLayerUrl();
    const { contextValue } = useMapContextState();

    const searchParams = useSearch({ from: '/_map/wetlandplants/' });
    const filtersFromUrl = searchParams.filters ?? {};
    const wetlandCql = filtersFromUrl[wetlandPlantsFilterSchema.recordKey];

    // Ensure layer is turned on if a filter is active
    useEffect(() => {
        if (wetlandCql) {
            updateLayerSelection(wetlandSurveySitesTitle, true);
        }
    }, [wetlandCql, updateLayerSelection]);

    // Parse current filter state
    const filterState = useMemo(
        () => fromCql(wetlandPlantsFilterSchema, wetlandCql),
        [wetlandCql]
    );

    const speciesVal = filterState['scientificname'];
    const speciesNames = useMemo(
        () => (speciesVal && speciesVal.kind === 'multiSelect' ? speciesVal.values : []),
        [speciesVal]
    );

    const speciesField = wetlandPlantsFilterSchema.fields.find(
        f => f.field === 'scientificname' && f.kind === 'multiSelect'
    );
    const speciesAsset = (speciesField && 'relatedAsset' in speciesField ? speciesField.relatedAsset : undefined) ?? 'wetlands_plants_species';
    const speciesJoinKey = (speciesField && 'foreignKey' in speciesField ? speciesField.foreignKey : undefined) ?? 'surveyeventid';
    const stacItemId = wetlandPlantsFilterSchema.stacItemId!;

    // Resolve matching surveyeventid numbers for selected species via DuckDB-WASM
    const { data: speciesEventIds, isError: isSpeciesError } = useQuery({
        queryKey: ['wetlands-species-event-ids', speciesNames],
        queryFn: async () => {
            if (speciesNames.length === 0) return [];
            const { fetchStacAssetHref } = await import('@/lib/map/stac/stac-layer');
            const url = await fetchStacAssetHref(stacItemId, speciesAsset);
            if (!url) {
                throw new Error(`Asset ${speciesAsset} missing on STAC item ${stacItemId}`);
            }
            const { withConnection, escapeSql, quoteIdent } = await import('@/lib/duckdb/client');
            return withConnection(async (conn) => {
                const inList = speciesNames.map(s => `'${escapeSql(s)}'`).join(',');
                const joinCol = quoteIdent(speciesJoinKey);
                const res = await conn.query(`
                    SELECT DISTINCT ${joinCol}
                    FROM read_parquet('${escapeSql(url)}')
                    WHERE scientificname IN (${inList}) AND ${joinCol} IS NOT NULL
                `);
                return res.toArray()
                    .map(r => r[speciesJoinKey])
                    .filter((id): id is number | bigint => id != null)
                    .map(Number);
            });
        },
        enabled: speciesNames.length > 0,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 10,
    });

    const vectorLayerFilters = useMemo(() => {
        const clauses: unknown[] = [];

        if (wetlandCql) {
            const attrExpr = toMaplibreFilter(wetlandPlantsFilterSchema, filterState);
            if (attrExpr) {
                clauses.push(attrExpr);
            }
        }

        if (speciesNames.length > 0) {
            if (speciesEventIds !== undefined) {
                if (speciesEventIds.length > 0) {
                    clauses.push(['in', ['get', speciesJoinKey], ['literal', speciesEventIds]]);
                } else {
                    clauses.push(['==', ['literal', 1], ['literal', 0]]);
                }
            } else if (isSpeciesError) {
                clauses.push(['==', ['literal', 1], ['literal', 0]]);
            }
        }

        const result: Record<string, FilterSpecification> = {};
        if (clauses.length > 0) {
            const filter = clauses.length === 1 ? clauses[0] : ['all', ...clauses];
            result[wetlandSurveySitesTitle] = filter as FilterSpecification;
        }
        return result;
    }, [wetlandCql, filterState, speciesNames.length, speciesEventIds, speciesJoinKey, isSpeciesError]);

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <div className="relative h-svh overflow-hidden bg-background">
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
                            <div className='ml-auto flex items-center space-x-4'>
                                {/* Search Combobox goes here */}
                            </div>
                        </Layout.Header>

                        {/* ===== Main ===== */}
                        <Layout.Body>
                            <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
                        </Layout.Body>

                        {/* ===== Footer ===== */}
                        {/* no footer on mobile */}
                        <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />

                    </Layout>
                </main>
            </div>
        </MapContext.Provider>
    )
}
