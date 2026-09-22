/* eslint-disable react-refresh/only-export-components */
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel';
import { Label } from '@/components/ui/label';
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
