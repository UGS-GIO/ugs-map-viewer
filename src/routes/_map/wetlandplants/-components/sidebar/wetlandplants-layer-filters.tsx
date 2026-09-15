/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useMap } from '@/hooks/use-map';
import { type FilterSchema } from '@/lib/filter/types';
import { wetlandSurveySitesTitle } from '../../-data/layers/layers';
import { wetlandPlantsFilterSchema } from '../../-data/layers/wetlandplants-schema';

interface WetlandPlantsFilterConfig {
    schema: FilterSchema;
    hideFields?: string[];
}

export const WETLANDPLANTS_FILTER_SCHEMAS: Record<string, WetlandPlantsFilterConfig> = {
    [wetlandSurveySitesTitle]: { schema: wetlandPlantsFilterSchema },
};

export function renderWetlandPlantsLayerFilters(layerTitle: string): React.ReactNode {
    const cfg = WETLANDPLANTS_FILTER_SCHEMAS[layerTitle];
    if (!cfg) return null;
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <SchemaFilters schema={cfg.schema} hideFields={cfg.hideFields} />
        </div>
    );
}

function SchemaFilters({ schema, hideFields }: WetlandPlantsFilterConfig) {
    const filter = useLayerFilter(schema);
    const { selectFeatures, clearAllSelections } = useMap();
    const navigate = useNavigate();
    const [isLoadingTable, setIsLoadingTable] = useState(false);

    const handleOpenTable = async () => {
        setIsLoadingTable(true);
        try {
            const { fetchStacAssetHref } = await import('@/lib/map/stac/stac-layer');
            const url = await fetchStacAssetHref(schema.stacItemId!, 'data');
            if (!url) throw new Error('Parquet data URL missing');

            const { withConnection, escapeSql } = await import('@/lib/duckdb/client');
            const { toSqlPredicates } = await import('@/lib/filter/generators');

            const predicates = toSqlPredicates(schema, filter.state);

            // If species filter is active, filter by matching surveyeventids
            const speciesVal = filter.state['scientificname'];
            const speciesNames = speciesVal && speciesVal.kind === 'multiSelect' ? speciesVal.values : [];
            let speciesCondition = '';
            if (speciesNames.length > 0) {
                const speciesAssetUrl = await fetchStacAssetHref(schema.stacItemId!, 'wetlands_plants_species');
                if (speciesAssetUrl) {
                    const inList = speciesNames.map(s => `'${escapeSql(s)}'`).join(',');
                    speciesCondition = `surveyeventid IN (
                        SELECT DISTINCT surveyeventid
                        FROM read_parquet('${escapeSql(speciesAssetUrl)}')
                        WHERE scientificname IN (${inList}) AND surveyeventid IS NOT NULL
                    )`;
                }
            }

            const allPredicates = [...predicates];
            if (speciesCondition) {
                allPredicates.push(speciesCondition);
            }

            const whereClause = allPredicates.length > 0 ? `WHERE ${allPredicates.join(' AND ')}` : '';

            const features = await withConnection(async (conn) => {
                const res = await conn.query(`
                    SELECT *
                    FROM read_parquet('${escapeSql(url)}')
                    ${whereClause}
                `);
                return res.toArray().map((row) => {
                    const props = row.toJSON() as Record<string, unknown>;
                    const x = Number(props.point_x) || 0;
                    const y = Number(props.point_y) || 0;
                    return {
                        id: (props.objectid as number) ?? (props.surveyeventid as number),
                        properties: props,
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [x, y],
                        },
                        layerTitle: wetlandSurveySitesTitle,
                    };
                });
            });

            selectFeatures(features);
            navigate({
                to: '.',
                search: (prev: Record<string, unknown>) => ({ ...prev, view: 'split' as const }),
                replace: true,
            });
        } catch (err) {
            console.error('Failed to open table for filtered sites:', err);
        } finally {
            setIsLoadingTable(false);
        }
    };

    const handleCloseTable = () => {
        clearAllSelections();
        navigate({
            to: '.',
            search: (prev: Record<string, unknown>) => ({ ...prev, view: undefined }),
            replace: true,
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Filters</Label>
                {filter.hasAnyFilter && (
                    <button
                        onClick={filter.clearAll}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                        Clear all
                    </button>
                )}
            </div>
            <LayerFilterPanel schema={schema} hideFields={hideFields} />
            <div className="flex items-center gap-2 pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleOpenTable}
                    disabled={isLoadingTable}
                >
                    {isLoadingTable ? 'Opening...' : 'Open table'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleCloseTable}
                >
                    Close table
                </Button>
            </div>
        </div>
    );
}
