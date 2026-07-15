import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLayerFilter } from '@/hooks/use-layer-filter'
import { useDistinctFieldOptions } from '@/hooks/use-distinct-field-options'
import type { FilterSchema, FilterFieldKind } from '@/lib/filter/types'
import type { LayerProps, PMTilesLayerProps, PMTilesRender, LegendEntry } from '@/lib/types/mapping-types'
import { isPMTilesLayer } from '@/lib/map/layer-utils'
import { ucrcWellsWMSTitle } from '../../-data/layers/layers'
import { ucrcFilterSchema } from '../../-data/layers/ucrc-schema'

/**
 * Interactive symbology legend for a PMTiles vector layer — the categorical
 * filter for the symbology field: pick the render (dropdown), see each category's
 * swatch + count, toggle categories/groups on/off (all on = no filter).
 *
 * Everything about symbology is DERIVED from the STAC render (ugs-styles → warehouse):
 * `render.field` (what to filter), `render.legend` (colours; `values` = the specific
 * category values a grouped entry rolls up; `stroke` = swatch outline). No colours,
 * groupings, or category lists are hardcoded here — change them in ugs-styles.
 */

// Sentinel emitted when every category is unchecked ("None") so the map shows nothing —
// an empty multiSelect means "no filter = all", the opposite of an all-off legend.
const NONE_SENTINEL = '__none__'

// A colour group derived from a legend entry that carries `values` (grouped renders,
// e.g. box types → Core/Cuttings/Other). Empty values = catch-all (the remainder).
interface LegendGroup { key: string; label: string; color: string; values: readonly string[] }

// One symbology option, derived from a STAC render.
interface Mode { id: string; label: string; field: string; entries: readonly LegendEntry[] }

const modesFromRenders = (renders: readonly PMTilesRender[]): Mode[] =>
    renders
        .filter(r => r.field)
        .map(r => ({ id: r.id, label: r.title ?? r.id, field: r.field ?? '', entries: r.legend ?? [] }))

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
    layer: PMTilesLayerProps
    schema: FilterSchema
}

/** Interactive symbology legend (render dropdown + category filter grid), derived from STAC. */
export function SymbologyLegend({ layer, schema }: SymbologyLegendProps) {
    const { value: active, setValue: setActive } = useVectorSymbology(layer.title ?? '')
    const modes = useMemo(() => modesFromRenders(layer.renders ?? []), [layer.renders])
    // Empty param → the layer's default render. Selecting a render writes its real id.
    const mode = modes.find(m => m.id === active)
        ?? modes.find(m => m.id === layer.defaultRenderId)
        ?? modes[0]
    const field = mode ? schema.fields.find(f => f.field === mode.field) : undefined
    if (!mode || !field) return null

    return (
        <div className="flex flex-col gap-2 px-1 py-1">
            {modes.length > 1 && (
                <div className="flex flex-col gap-1">
                    <Label className="text-xs font-medium">Symbolize by</Label>
                    <Select value={mode.id} onValueChange={setActive}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {modes.map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <CategoryLegendGrid schema={schema} field={field} entries={mode.entries} />
        </div>
    )
}

function CategoryLegendGrid({ schema, field, entries }: { schema: FilterSchema; field: FilterFieldKind; entries: readonly LegendEntry[] }) {
    const mgr = useLayerFilter(schema)
    const isContains = field.kind === 'containsAny'
    const { data, isLoading } = useDistinctFieldOptions({ schema, state: mgr.state, field, splitCommaDelimited: isContains })
    const counts = data?.counts ?? {}
    // All distinct values, ordered by feature count (desc), alpha tiebreak.
    const options = useMemo(() => {
        const c = data?.counts ?? {}
        return [...(data?.options ?? [])].sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0) || a.localeCompare(b))
    }, [data])

    // Colour + stroke per value, derived from the render's legend (flat renders: label == value).
    const swatch = useMemo(() => new Map(entries.map(e => [e.label, e.color])), [entries])
    const stroke = useMemo(() => new Map(entries.map(e => [e.label, e.stroke])), [entries])
    // Grouped render when any legend entry carries `values`; each entry becomes a colour group.
    const groups = useMemo<LegendGroup[] | null>(() =>
        entries.some(e => e.values && e.values.length)
            ? entries.map(e => ({ key: e.label, label: e.label, color: e.color, values: e.values ?? [] }))
            : null
    , [entries])

    // Filter value holds the SHOWN set. Empty = all on. NONE_SENTINEL = all off.
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

    // Auto-fit: 2 columns when the sidebar is wide enough, 1 on narrow screens.
    // `groupColor` (when set) overrides per-value swatches with the group's colour.
    const renderRows = (items: string[], groupColor?: string) => (
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
                        style={{ backgroundColor: groupColor ?? swatch.get(label) ?? '#bdbdbd', borderColor: stroke.get(label) ?? 'rgba(0,0,0,0.3)' }}
                    />
                    <span className="min-w-0 break-words leading-tight">
                        {label}
                        {counts[label] != null && <span className="ml-1 text-muted-foreground">({counts[label].toLocaleString()})</span>}
                    </span>
                </label>
            ))}
        </div>
    )

    const controls = (
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
    )
    const resetBtn = mgr.hasAnyFilter && (
        <Button variant="ghost" size="sm" className="h-6 self-start px-2 text-xs" onClick={mgr.clearAll}>
            Reset all filters
        </Button>
    )

    // Grouped layout: a coloured header per group (toggles the whole group), its specific
    // values spelled out beneath. Empty `values` = catch-all (everything not in another group).
    if (groups) {
        const claimed = new Set(groups.flatMap(g => [...g.values]))
        const membersOf = (g: LegendGroup) =>
            g.values.length ? options.filter(o => g.values.includes(o)) : options.filter(o => !claimed.has(o))
        return (
            <div className="flex flex-col gap-2">
                {controls}
                {groups.map(g => {
                    const items = membersOf(g)
                    if (items.length === 0) return null
                    const onCount = items.filter(i => onSet.has(i)).length
                    const groupChecked: boolean | 'indeterminate' = onCount === items.length ? true : onCount === 0 ? false : 'indeterminate'
                    const toggleGroup = () => {
                        const next = new Set(onSet)
                        if (onCount === items.length) items.forEach(i => next.delete(i))
                        else items.forEach(i => next.add(i))
                        emit(next)
                    }
                    return (
                        <div key={g.key} className="flex flex-col gap-1">
                            <label className="flex items-center gap-1.5 border-t border-border pt-1.5 mt-0.5 cursor-pointer">
                                <Checkbox className="shrink-0" checked={groupChecked} onCheckedChange={toggleGroup} aria-label={`Toggle ${g.label} group`} />
                                <span className="inline-block w-3 h-3 rounded-full shrink-0 border" style={{ backgroundColor: g.color, borderColor: 'rgba(0,0,0,0.3)' }} />
                                <Label className="text-xs font-semibold cursor-pointer">{g.label}</Label>
                            </label>
                            <div className="pl-4">{renderRows(items, g.color)}</div>
                        </div>
                    )
                })}
                {resetBtn}
            </div>
        )
    }

    // Flat layout: one swatch per value, coloured from the render's legend.
    return (
        <div className="flex flex-col gap-2">
            {controls}
            {renderRows(options)}
            {resetBtn}
        </div>
    )
}

// ─── UCRC wiring ────────────────────────────────────────────────────────────

/** `layerLegendRender` for the subsurface layer list. Symbology is derived from the layer's STAC renders. */
export function renderSubsurfaceLegend(layer: LayerProps): React.ReactNode {
    if (layer.title === ucrcWellsWMSTitle && isPMTilesLayer(layer)) {
        return <SymbologyLegend layer={layer} schema={ucrcFilterSchema} />
    }
    return null
}
