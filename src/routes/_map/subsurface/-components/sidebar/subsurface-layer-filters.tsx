import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type FilterSchema, type FilterFieldKind } from '@/lib/filter/types'
import { ucrcWellsWMSTitle, UCRC_BOX_TYPE_CODES, UCRC_BOX_TYPE_COLORS } from '../../-data/layers/layers'
import { ucrcFilterSchema } from '../../-data/layers/ucrc-schema'

/**
 * Registry of per-layer filter schemas for the subsurface map, keyed by the
 * layer's title (the same string `useCustomLayerList` passes to its
 * `layerExtrasRender` slot). This is the standard way to add a layer filter to
 * the layer-list dropdown: define a {@link FilterSchema} and register it here —
 * the matching layer automatically grows a "Filters" toggle in its accordion.
 *
 * Schemas drive URL-persisted CQL via `useLayerFilter`, so the filter state is
 * shareable and independent of where the panel is mounted (it previously lived
 * in the Map Configurations sidebar).
 */
export const SUBSURFACE_FILTER_SCHEMAS: Record<string, FilterSchema> = {
    [ucrcWellsWMSTitle]: ucrcFilterSchema,
}

/**
 * `layerExtrasRender` for the subsurface layer list. Composes a layer's
 * Filters-slot content: the UCRC symbology selector (display option) plus the
 * schema-driven filter panel for any layer with a registered schema. Returns
 * null when a layer has neither, so the Filters slot stays hidden.
 */
export function renderSubsurfaceLayerFilters(layerTitle: string): React.ReactNode {
    // UCRC has its own symbology selector + a symbology-aware schema, so it's
    // rendered by a dedicated component (hooks can't run in this plain function).
    if (layerTitle === ucrcWellsWMSTitle) return <UcrcFilters />
    const schema = SUBSURFACE_FILTER_SCHEMAS[layerTitle]
    if (!schema) return null
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <SchemaFilters schema={schema} />
        </div>
    )
}

function UcrcFilters() {
    const schema = useUcrcSchema()
    return (
        <div className="flex flex-col gap-3 px-2 py-1">
            <UcrcSymbology />
            <SchemaFilters schema={schema} />
        </div>
    )
}

/**
 * UCRC filter schema, adapted to the active symbology. The field whose colors
 * the map is drawing renders as the prominent swatch grid; the other becomes a
 * plain combobox. Filter values for both fields persist independently in the
 * CQL regardless of symbology — only the presentation swaps.
 */
function useUcrcSchema(): FilterSchema {
    const { value: symbology } = useVectorSymbology(ucrcWellsWMSTitle)
    return useMemo(() => {
        if (symbology !== SYMBOLOGY_BOX_TYPE) return ucrcFilterSchema
        const fields: FilterFieldKind[] = ucrcFilterSchema.fields.map((f): FilterFieldKind => {
            // Box Type → swatch grid (wedge colors). Limit to the codes the map
            // actually symbolizes (UCRC_BOX_TYPE_CODES); other box types in the
            // data have no wedge color, so they're hidden from this grid to keep
            // the swatches honest against the map.
            if (f.field === 'box_type_codes' && f.kind === 'containsAny') {
                return {
                    ...f,
                    optionSwatches: UCRC_BOX_TYPE_COLORS,
                    optionLabelFilter: (label: string) => (UCRC_BOX_TYPE_CODES as readonly string[]).includes(label),
                }
            }
            // Purpose → plain combobox (drop swatches so it stops rendering as the grid).
            if (f.field === 'purpose' && f.kind === 'multiSelect') {
                return { kind: 'multiSelect', field: f.field, label: f.label, placeholder: 'Select purpose...' }
            }
            return f
        })
        // Hoist Box Type to the top, where Purpose's grid normally sits.
        const boxIdx = fields.findIndex(f => f.field === 'box_type_codes')
        if (boxIdx > 0) {
            const [boxField] = fields.splice(boxIdx, 1)
            fields.unshift(boxField)
        }
        return { ...ucrcFilterSchema, fields }
    }, [symbology])
}

function SchemaFilters({ schema }: { schema: FilterSchema }) {
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
            <LayerFilterPanel schema={schema} />
        </div>
    )
}

// ─── UCRC symbology selector (URL-driven) ──────────────────────────────────
// Moved out of the Map Configurations sidebar so a layer's display options sit
// alongside its filters in the layer-list dropdown.

const SYMBOLOGY_PURPOSE = ''
// Matches the STAC render id the warehouse publishes; selecting it sets
// vector_symbology so the live PMTiles renderer draws the by-boxtype render.
const SYMBOLOGY_BOX_TYPE = 'by-boxtype'

function useVectorSymbology(layerTitle: string) {
    const navigate = useNavigate({ from: '/subsurface/' })
    const search = useSearch({ from: '/_map/subsurface/' })

    const value = useMemo(
        () => (search.vector_symbology as Record<string, string> | undefined)?.[layerTitle] ?? SYMBOLOGY_PURPOSE,
        [search.vector_symbology, layerTitle],
    )

    const setValue = useCallback((next: string) => {
        navigate({
            search: (prev) => {
                const current = (prev.vector_symbology as Record<string, string> | undefined) || {}
                if (next && next !== SYMBOLOGY_PURPOSE) {
                    return { ...prev, vector_symbology: { ...current, [layerTitle]: next } }
                }
                const { [layerTitle]: _removed, ...rest } = current
                return { ...prev, vector_symbology: Object.keys(rest).length > 0 ? rest : undefined }
            },
            replace: true,
        })
    }, [navigate, layerTitle])

    return { value, setValue }
}

function UcrcSymbology() {
    const { value: symbology, setValue: setSymbology } = useVectorSymbology(ucrcWellsWMSTitle)

    // No color key here on purpose: the Legend toggle (WfsVectorLegend) already
    // renders the box-type wedge swatches, and the Box Type filter grid repeats
    // them too — a third copy under the selector was pure duplication.
    return (
        <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Symbolize by</Label>
            <Select value={symbology || 'purpose'} onValueChange={(v) => setSymbology(v === 'purpose' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="purpose" className="text-xs">Purpose</SelectItem>
                    <SelectItem value={SYMBOLOGY_BOX_TYPE} className="text-xs">Box Type</SelectItem>
                </SelectContent>
            </Select>
        </div>
    )
}
