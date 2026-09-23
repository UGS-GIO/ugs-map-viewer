/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react';
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel';
import { useActiveSymbologyField } from '@/components/sidebar/filter/symbology-legend';
import { Label } from '@/components/ui/label';
import { type FilterSchema } from '@/lib/filter/types';
import { isPMTilesLayer } from '@/lib/map/layer-utils';
import { type LayerProps, type PMTilesLayerProps } from '@/lib/types/mapping-types';
import { wetlandSurveySitesTitle, wetlandSurveySitesConfig } from '../../-data/layers/layers';
import { wetlandPlantsFilterSchema } from '../../-data/layers/wetlandplants-schema';

interface WetlandPlantsFilterConfig {
    schema: FilterSchema;
    layer?: PMTilesLayerProps;
    hideFields?: string[];
}

export const WETLANDPLANTS_FILTER_SCHEMAS: Record<string, WetlandPlantsFilterConfig> = {
    [wetlandSurveySitesTitle]: { schema: wetlandPlantsFilterSchema, layer: wetlandSurveySitesConfig },
};

export function renderWetlandPlantsLayerFilters(layerTitle: string, layer?: LayerProps): React.ReactNode {
    const cfg = WETLANDPLANTS_FILTER_SCHEMAS[layerTitle];
    if (!cfg) return null;
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <SchemaFilters
                schema={cfg.schema}
                layer={layer && isPMTilesLayer(layer) ? layer : cfg.layer}
                defaultHideFields={cfg.hideFields}
            />
        </div>
    );
}

function SchemaFilters({
    schema,
    layer,
    defaultHideFields,
}: {
    schema: FilterSchema;
    layer?: PMTilesLayerProps;
    defaultHideFields?: string[];
}) {
    const filter = useLayerFilter(schema);
    const activeSymbologyField = useActiveSymbologyField(layer);
    const hideFields = useMemo(() => {
        if (!activeSymbologyField) return defaultHideFields;
        return [...(defaultHideFields ?? []), activeSymbologyField];
    }, [activeSymbologyField, defaultHideFields]);

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
        </div>
    );
}
