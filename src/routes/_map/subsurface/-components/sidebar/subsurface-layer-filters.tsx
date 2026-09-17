import { useMemo } from 'react'
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel'
import { useActiveSymbologyField } from '@/components/sidebar/filter/symbology-legend'
import { Label } from '@/components/ui/label'
import { type FilterSchema } from '@/lib/filter/types'
import { isPMTilesLayer } from '@/lib/map/layer-utils'
import { type LayerProps, type PMTilesLayerProps } from '@/lib/types/mapping-types'
import { ucrcWellsWMSTitle, ucrcWellsConfig } from '@/routes/_map/-shared/layers/ucrc-wells'
import { ucrcFilterSchema } from '@/routes/_map/-shared/layers/ucrc-schema'

/**
 * Per-layer filter config for the subsurface layer list (`layerExtrasRender`).
 * Whichever symbology field is currently active in the interactive legend is hidden
 * from the Filters panel; the inactive symbology field(s) render as regular dropdown
 * filters alongside the rest of the schema.
 */
interface SubsurfaceFilterConfig {
    schema: FilterSchema
    layer?: PMTilesLayerProps
    hideFields?: string[]
}

export const SUBSURFACE_FILTER_SCHEMAS: Record<string, SubsurfaceFilterConfig> = {
    [ucrcWellsWMSTitle]: { schema: ucrcFilterSchema, layer: ucrcWellsConfig },
}

export function renderSubsurfaceLayerFilters(layerTitle: string, layer?: LayerProps): React.ReactNode {
    const cfg = SUBSURFACE_FILTER_SCHEMAS[layerTitle]
    if (!cfg) return null
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <SchemaFilters
                schema={cfg.schema}
                layer={layer && isPMTilesLayer(layer) ? layer : cfg.layer}
                defaultHideFields={cfg.hideFields}
            />
        </div>
    )
}

function SchemaFilters({
    schema,
    layer,
    defaultHideFields,
}: {
    schema: FilterSchema
    layer?: PMTilesLayerProps
    defaultHideFields?: string[]
}) {
    const filter = useLayerFilter(schema)
    const activeSymbologyField = useActiveSymbologyField(layer)
    const hideFields = useMemo(() => {
        if (!activeSymbologyField) return defaultHideFields
        return [activeSymbologyField]
    }, [activeSymbologyField, defaultHideFields])

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
