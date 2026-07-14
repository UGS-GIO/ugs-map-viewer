import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLayerFilter } from '@/hooks/use-layer-filter'
import { useDistinctFieldOptions } from '@/hooks/use-distinct-field-options'
import type { FilterSchema, FilterFieldKind } from '@/lib/filter/types'
import { ucrcWellsWMSTitle, UCRC_BOX_TYPE_CODES, UCRC_BOX_TYPE_COLORS, UCRC_PURPOSE_COLORS, UCRC_PURPOSE_STROKES } from '../../-data/layers/layers'
import { ucrcFilterSchema } from '../../-data/layers/ucrc-schema'

/**
 * Interactive symbology legend for a vector layer. Replaces the static swatch
 * legend AND the separate "Symbolize by" control: the legend is now the
 * categorical filter for the symbology field — pick the field (dropdown), see
 * each category's swatch + count, toggle categories on/off (all on = no filter),
 * with Select all / none. Vector-only (WMS legends are server images).
 */

export interface LegendSymbologyMode {
    /** vector_symbology value that selects this mode ('' = default). */
    id: string
    /** Dropdown label. */
    label: string
    /** Schema field this mode colors + filters by. */
    field: string
    /** Category value → fill color. */
    swatches: Record<string, string>
    /** Category value → stroke color (optional). */
    strokes?: Record<string, string>
    /** Limit shown categories (e.g. only the symbolized box-type codes). */
    optionLabelFilter?: (label: string) => boolean
    /** Order categories by feature count (descending) instead of the query order. */
    sortByCount?: boolean
    /** Categories shown first (the symbolized/colored ones), above a divider. */
    primaryValues?: readonly string[]
    /** Divider label above the non-primary categories. */
    othersLabel?: string
}

// Sentinel emitted when every category is unchecked ("Select none") so the map
// shows nothing — an empty multiSelect means "no filter = all", which is the
// opposite of what an all-off legend should do.
const NONE_SENTINEL = '__none__'

/** Generic symbology read/write on the route's `vector_symbology` search param. */
function useVectorSymbology(layerTitle: string) {
    const navigate = useNavigate()
    const search = useSearch({ strict: false }) as { vector_symbology?: Record<string, string> }
    const value = search.vector_symbology?.[layerTitle] ?? ''
    const setValue = useCallback((next: string) => {
        navigate({
            // @ts-expect-error generic search update preserves the current route
            search: (prev: Record<string, unknown>) => {
                const current = (prev.vector_symbology as Record<string, string> | undefined) || {}
                if (next) return { ...prev, vector_symbology: { ...current, [layerTitle]: next } }
                const { [layerTitle]: _drop, ...rest } = current
                return { ...prev, vector_symbology: Object.keys(rest).length ? rest : undefined }
            },
            replace: true,
        })
    }, [navigate, layerTitle])
    return { value, setValue }
}

interface SymbologyLegendProps {
    layerTitle: string
    schema: FilterSchema
    modes: LegendSymbologyMode[]
}

/** Generic interactive symbology legend (dropdown + category filter grid). */
export function SymbologyLegend({ layerTitle, schema, modes }: SymbologyLegendProps) {
    const { value: active, setValue: setActive } = useVectorSymbology(layerTitle)
    const mode = modes.find(m => m.id === active) ?? modes[0]
    const field = schema.fields.find(f => f.field === mode.field)
    if (!field) return null

    return (
        <div className="flex flex-col gap-2 px-1 py-1">
            {modes.length > 1 && (
                <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium">Symbolize by</Label>
                    <Select value={mode.id || '__default__'} onValueChange={(v) => setActive(v === '__default__' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {modes.map(m => (
                                <SelectItem key={m.id || '__default__'} value={m.id || '__default__'} className="text-xs">{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <CategoryLegendGrid schema={schema} field={field} mode={mode} />
        </div>
    )
}

function CategoryLegendGrid({ schema, field, mode }: { schema: FilterSchema; field: FilterFieldKind; mode: LegendSymbologyMode }) {
    const mgr = useLayerFilter(schema)
    const isContains = field.kind === 'containsAny'
    const { data, isLoading } = useDistinctFieldOptions({ schema, state: mgr.state, field, splitCommaDelimited: isContains })
    const counts = data?.counts ?? {}
    const options = useMemo(() => {
        const c = data?.counts ?? {}
        let all = data?.options ?? []
        if (mode.optionLabelFilter) all = all.filter(mode.optionLabelFilter)
        if (mode.sortByCount || mode.primaryValues) {
            // Symbolized (primary) categories first, then by feature count (desc),
            // alpha tiebreak — count order applies within each tier.
            const primary = new Set(mode.primaryValues ?? [])
            all = [...all].sort((a, b) => {
                const pa = primary.has(a), pb = primary.has(b)
                if (pa !== pb) return pa ? -1 : 1
                return (c[b] ?? 0) - (c[a] ?? 0) || a.localeCompare(b)
            })
        }
        return all
    }, [data, mode])

    // Filter value holds the SHOWN set (multiSelect/containsAny `values`).
    // Empty = no filter = all on. NONE_SENTINEL = all off (show nothing).
    const raw = mgr.state[field.field]
    const values = raw && (raw.kind === 'multiSelect' || raw.kind === 'containsAny') ? raw.values : []
    const allOn = values.length === 0
    const noneOn = values.length === 1 && values[0] === NONE_SENTINEL
    const onSet = useMemo(() => {
        if (allOn) return new Set(options)
        if (noneOn) return new Set<string>()
        return new Set(values)
    }, [allOn, noneOn, values, options])

    const emit = useCallback((next: Set<string>) => {
        const kind = field.kind === 'containsAny' ? 'containsAny' : 'multiSelect'
        if (next.size === options.length) mgr.setField(field.field, { kind, values: [] })
        else if (next.size === 0) mgr.setField(field.field, { kind, values: [NONE_SENTINEL] })
        else mgr.setField(field.field, { kind, values: options.filter(o => next.has(o)) })
    }, [field, options, mgr])

    const toggle = (label: string) => {
        const next = new Set(onSet)
        if (next.has(label)) next.delete(label); else next.add(label)
        emit(next)
    }

    if (isLoading) return <p className="text-xs text-muted-foreground px-1">Loading…</p>
    if (options.length === 0) return null

    // Split into the symbolized "primary" tier and the rest, for the divider.
    const primarySet = new Set(mode.primaryValues ?? [])
    const hasTiers = !!mode.primaryValues && options.some(o => primarySet.has(o)) && options.some(o => !primarySet.has(o))
    const primary = hasTiers ? options.filter(o => primarySet.has(o)) : options
    const others = hasTiers ? options.filter(o => !primarySet.has(o)) : []

    // Auto-fit: 2 columns when the sidebar is wide enough, 1 on narrow screens.
    const renderRows = (items: string[]) => (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-1.5">
            {items.map(label => (
                <label key={label} className="flex min-w-0 items-start gap-1.5 pr-1 text-xs cursor-pointer">
                    <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={onSet.has(label)}
                        onCheckedChange={() => toggle(label)}
                        aria-label={`Toggle ${label}`}
                    />
                    <span
                        className="mt-0.5 inline-block w-3 h-3 rounded-full shrink-0 border"
                        style={{ backgroundColor: mode.swatches[label] ?? '#bdbdbd', borderColor: mode.strokes?.[label] ?? 'rgba(0,0,0,0.3)' }}
                    />
                    <span className="min-w-0 break-words leading-tight">
                        {label}
                        {counts[label] != null && <span className="ml-1 text-muted-foreground">({counts[label].toLocaleString()})</span>}
                    </span>
                </label>
            ))}
        </div>
    )

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                <div className="flex items-center gap-2">
                    <button
                        className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-40 disabled:no-underline"
                        disabled={allOn}
                        onClick={() => emit(new Set(options))}
                    >All</button>
                    <button
                        className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-40 disabled:no-underline"
                        disabled={onSet.size === 0}
                        onClick={() => emit(new Set())}
                    >None</button>
                </div>
            </div>
            {renderRows(primary)}
            {others.length > 0 && (
                <>
                    <Label className="text-xs font-medium text-muted-foreground border-t border-border pt-1.5 mt-0.5">{mode.othersLabel ?? 'Other'}</Label>
                    {renderRows(others)}
                </>
            )}
            {mgr.hasAnyFilter && (
                <Button variant="ghost" size="sm" className="h-6 self-start px-2 text-xs" onClick={mgr.clearAll}>
                    Reset all filters
                </Button>
            )}
        </div>
    )
}

// ─── UCRC wiring ────────────────────────────────────────────────────────────

// Sample Type (box-type) is the default on page load: id '' = the default
// sentinel (empty vector_symbology → map falls back to defaultRenderId
// 'by-boxtype'). Purpose carries its real STAC render key so selecting it writes
// a value activeRenderOf can match directly. Order = dropdown order.
const UCRC_LEGEND_MODES: LegendSymbologyMode[] = [
    {
        id: '',
        label: 'Sample Type',
        field: 'box_type_codes',
        swatches: UCRC_BOX_TYPE_COLORS,
        sortByCount: true,
        primaryValues: UCRC_BOX_TYPE_CODES,
        othersLabel: 'Other sample types',
    },
    { id: 'by-purpose', label: 'Purpose', field: 'purpose', swatches: UCRC_PURPOSE_COLORS, strokes: UCRC_PURPOSE_STROKES },
]

/** `layerLegendRender` for the subsurface layer list. */
export function renderSubsurfaceLegend(layerTitle: string): React.ReactNode {
    if (layerTitle === ucrcWellsWMSTitle) {
        return <SymbologyLegend layerTitle={ucrcWellsWMSTitle} schema={ucrcFilterSchema} modes={UCRC_LEGEND_MODES} />
    }
    return null
}
