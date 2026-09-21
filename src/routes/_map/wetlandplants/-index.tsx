import { useMemo, useEffect } from 'react'
import type { FilterSpecification } from 'maplibre-gl'
import { useSearch } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useLayerUrl } from '@/context/layer-url-provider'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { fromCql } from '@/lib/filter/parse'
import { toMaplibreFilter } from '@/lib/filter/generators'
import { wetlandSurveySitesTitle } from './-data/layers/layers'
import { wetlandPlantsFilterSchema } from './-data/layers/wetlandplants-schema'

export default function Map() {
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
    const { data: speciesEventIds, isLoading: isSpeciesLoading } = useQuery({
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

    const vectorLayerFilters = useMemo<Record<string, FilterSpecification>>(() => {
        const clauses: unknown[] = [];

        if (wetlandCql) {
            const attrExpr = toMaplibreFilter(wetlandPlantsFilterSchema, filterState);
            if (attrExpr) {
                clauses.push(attrExpr);
            }
        }

        if (speciesNames.length > 0) {
            if (isSpeciesLoading) {
                // Fail-closed while loading, not just on empty/error — sites blank then pop back on first species pick. Gate on isLoading.
                clauses.push(['==', ['literal', 1], ['literal', 0]]);
            } else if (speciesEventIds && speciesEventIds.length > 0) {
                clauses.push(['in', ['get', speciesJoinKey], ['literal', speciesEventIds]]);
            } else {
                // Fail-closed when 0 sites match or query failed
                clauses.push(['==', ['literal', 1], ['literal', 0]]);
            }
        }

        const result: Record<string, FilterSpecification> = {};
        if (clauses.length === 1) {
            result[wetlandSurveySitesTitle] = clauses[0] as FilterSpecification;
        } else if (clauses.length > 1) {
            result[wetlandSurveySitesTitle] = ['all', ...clauses] as FilterSpecification;
        }
        return result;
    }, [wetlandCql, filterState, speciesNames.length, speciesEventIds, isSpeciesLoading, speciesJoinKey]);

    return (
        <MapContext.Provider value={contextValue}>
            <TourAutoStart />
            <MapShell>
                <GenericMapContainer vectorLayerFilters={vectorLayerFilters} />
            </MapShell>
        </MapContext.Provider>
    )
}
