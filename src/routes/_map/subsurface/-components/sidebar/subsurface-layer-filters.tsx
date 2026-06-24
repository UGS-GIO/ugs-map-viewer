import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel'
import { Label } from '@/components/ui/label'
import { type FilterSchema } from '@/lib/filter/types'
import { ucrcWellsWMSTitle } from '../../-data/layers/layers'
import { ucrcFilterSchema } from '../../-data/layers/ucrc-schema'

/**
 * Per-layer filter config for the subsurface layer list (`layerExtrasRender`).
 * Symbology fields (purpose, box type) now live in the interactive **legend**
 * (see subsurface-symbology-legend), so they're hidden here — but kept in the
 * full schema so the shared CQL round-trips and the legend + filters don't
 * clobber each other's clauses.
 */
interface SubsurfaceFilterConfig {
    schema: FilterSchema
    /** Fields surfaced in the legend instead of the Filters panel. */
    hideFields?: string[]
}

export const SUBSURFACE_FILTER_SCHEMAS: Record<string, SubsurfaceFilterConfig> = {
    [ucrcWellsWMSTitle]: { schema: ucrcFilterSchema, hideFields: ['purpose', 'box_type_codes'] },
}

export function renderSubsurfaceLayerFilters(layerTitle: string): React.ReactNode {
    const cfg = SUBSURFACE_FILTER_SCHEMAS[layerTitle]
    if (!cfg) return null
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <SchemaFilters schema={cfg.schema} hideFields={cfg.hideFields} />
        </div>
    )
}

function SchemaFilters({ schema, hideFields }: SubsurfaceFilterConfig) {
    const filter = useLayerFilter(schema)
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
    )
}
