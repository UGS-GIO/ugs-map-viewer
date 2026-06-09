import { useMemo, useState } from 'react'
import area from '@turf/area'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, Rectangle, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Label as RechartsLabel, type BarShapeProps } from 'recharts'
import type { LayerContentProps } from '@/components/maps/popups/types'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRightIcon } from 'lucide-react'
import { useDisplacementFilters, useEffectiveThresholdsIn, useEffectiveYear } from './displacement-filter-context'
import { useMap } from '@/hooks/use-map'
import { DISPLACEMENT_LAYER_TYPES, getStyleNameForType, getUnitsLabelForType, isChartedType, isDisplacementLayerTitle, type ChartedType, type DisplacementType } from './displacement-layers'
import { getZeroBound, type SldBin } from './displacement-sld-legend'
import {
    getBucketYear,
    useDisplacementFeaturesByType,
    useDisplacementSldBins,
    type DisplacementFeature,
} from './use-displacement-queries'

// Hard fallback when SLD's Zero deadband can't be resolved. Mirrors the value
// in displacement-filter-context — defined locally so this file's KPI/metric
// math doesn't depend on the threshold context's React-only export surface.
const FALLBACK_THRESHOLD_IN = 1.2

const SQM_TO_SQMI = 1 / 2_589_988.110336

// Stacked-bar chart height in px. Shared by the chart wrapper and recharts'
// ResponsiveContainer so a numeric height (not '100%') is always passed —
// recharts v3 logs a width/height warning when it measures 0 at mount.
const CHART_HEIGHT_PX = 224

// Round to 1 decimal place for popup display.
const fmt1 = (n: number): string => n.toFixed(1)

// Resolve a charted type to its SLD style. Wraps getStyleNameForType so chart
// code can stay strict about charted types without falling back at every call.
function getChartedStyleName(type: ChartedType): string {
    const name = getStyleNameForType(type)
    if (!name) throw new Error(`No SLD style registered for charted type "${type}"`)
    return name
}

// Popup-side: tiny chip explaining filter applicability per layer. Used by
// PopupContentWithPagination's layerHeaderExtras render-prop. Charts moved to
// the sidebar Stats slot — popup no longer carries whole-layer chart cards.
export function renderDisplacementLayerHeader(layer: LayerContentProps): React.ReactNode {
    return <LayerHeaderChip layer={layer} />
}

function LayerHeaderChip({ layer }: { layer: LayerContentProps }) {
    const title = layer.layerTitle || layer.groupLayerTitle || ''

    if (!isDisplacementLayerTitle(title)) {
        return (
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <span>Outside Water Year filter</span>
            </div>
        )
    }

    const typeValue = DISPLACEMENT_LAYER_TYPES[title]
    if (!isChartedType(typeValue) || typeValue === 'Cumulative') {
        return (
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <span>Period-keyed · Water Year does not apply</span>
            </div>
        )
    }

    return null
}

// Sidebar-side: full whole-layer chart card (KPIs + stacked bar) rendered inside
// each charted displacement layer's accordion via the Stats toggle.
export function renderDisplacementLayerStats(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[layerTitle]
    if (!isChartedType(typeValue)) return null
    return <DisplacementLayerCharts typeValue={typeValue} />
}

// Locate which SldBin a feature's signed value_inch falls into. Half-open on the
// upper bound matches the SLD's "value_inch < X" semantics so each feature
// resolves to exactly one bin.
export function findBin(bins: SldBin[], v: number): SldBin | undefined {
    return bins.find(b => v >= b.min && v < b.max)
}

// Compute [minLng, minLat, maxLng, maxLat] across a feature collection without
// pulling in turf. Walks Polygon/MultiPolygon coordinate trees recursively and
// skips non-finite numbers so a single bad coord pair can't poison fitBounds.
function combinedBbox(features: DisplacementFeature[]): [number, number, number, number] | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const visit = (node: unknown): void => {
        if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
            const x = node[0], y = node[1]
            if (!Number.isFinite(x) || !Number.isFinite(y)) return
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        } else if (Array.isArray(node)) {
            for (const child of node) visit(child)
        }
    }
    for (const f of features) {
        if (f.geometry?.coordinates) visit(f.geometry.coordinates)
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
    if (minX > maxX || minY > maxY) return null
    return [minX, minY, maxX, maxY]
}

function DisplacementLayerCharts({ typeValue }: { typeValue: ChartedType }) {
    const { yearOverride, basinsByType, thresholdsIn, addBasin, removeBasin, setYearOverride, clearBasins } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    // Year is mandatory now (no "all years" sentinel): falls back to the
    // latest available year for this type while the user hasn't picked one.
    const year = useEffectiveYear(typeValue)
    // `visualThreshold` is the user-tunable knob that drives ONLY the stacked
    // bar (visual emphasis). Every KPI / metric / basin ranking uses
    // `auditThreshold` — pinned to the SLD's Zero deadband — so reviewers
    // can't quietly raise the bar and make subsidence "disappear" from the
    // summary numbers.
    const visualThreshold = effective[typeValue]
    const styleName = getChartedStyleName(typeValue)
    const selectedBasins = basinsByType[typeValue]
    const basinFilterActive = selectedBasins.size > 0

    // Pre-sliced to this type via TanStack `select` so unrelated type updates
    // don't churn this component.
    const { data: features = [], isLoading: featuresLoading, isError } = useDisplacementFeaturesByType(typeValue)

    // Bins come from the SLD's own classification so the chart matches the map.
    // The 'Zero' deadband is excluded from plotBins below since features in it
    // aren't subsiding meaningfully — they're folded into the threshold filter.
    const { data: sldBins = [], isLoading: binsLoading } = useDisplacementSldBins(styleName)

    const plotBins = useMemo(() => sldBins.filter(b => !b.isZero), [sldBins])
    const auditThreshold = useMemo(
        () => getZeroBound(sldBins) ?? FALLBACK_THRESHOLD_IN,
        [sldBins],
    )
    const rawUserThreshold = thresholdsIn[typeValue]
    const thresholdDirty = rawUserThreshold !== null && Math.abs(visualThreshold - auditThreshold) > 1e-6

    // Split SLD bins by sign and order each side so the stack reads outward
    // from zero: closest-to-zero bin first, deepest band last. Negative bins
    // stack downward (subsidence) and positive bins upward (uplift) below.
    const subsidenceBins = useMemo(
        () => plotBins.filter(b => b.max <= 0).sort((a, b) => b.max - a.max),
        [plotBins]
    )
    const upliftBins = useMemo(
        () => plotBins.filter(b => b.min >= 0).sort((a, b) => a.min - b.min),
        [plotBins]
    )
    // Stack declaration order: subsidence first (extends downward), then uplift
    // (extends upward). Each Bar's segment lands further from zero than the
    // last in its sign group.
    const stackedBinOrder = useMemo(
        () => [...subsidenceBins, ...upliftBins],
        [subsidenceBins, upliftBins]
    )
    const isLoading = featuresLoading || binsLoading

    // `features` is already typeValue-sliced by useDisplacementFeaturesByType.
    // Empty basin set = all basins.
    const scoped = useMemo(
        () => selectedBasins.size === 0
            ? features
            : features.filter(f => selectedBasins.has(f.properties.location)),
        [features, selectedBasins]
    )

    // Year filter resolution: Yearly matches `year`; Cumulative matches the
    // year of `end_date` (so picking 2024 narrows to the 2017-2024 window etc.).
    // Null year means the features-query is still loading — render empty.
    const filtered = useMemo(() => {
        if (!year) return []
        return scoped.filter(f => {
            const bucket = getBucketYear(f.properties)
            return bucket === year
        })
    }, [scoped, year])

    const yearAxisLabel = typeValue === 'Cumulative' ? 'Period End Year' : 'Water Year'

    // KPI + advanced metrics are pinned to auditThreshold (SLD Zero deadband)
    // so they can't be tuned away by an over-cranked threshold setting.
    const auditOverThreshold = useMemo(
        () => filtered.filter(f => Math.abs(f.properties.value_inch) >= auditThreshold),
        [filtered, auditThreshold]
    )

    const totalAreaSqMi = useMemo(
        () => auditOverThreshold.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [auditOverThreshold]
    )

    // Subsiding vs uplift area at the SLD-default bound. Used by the
    // subsidence/uplift ratio metric and the areal-coverage breakdown.
    const signedAreaSqMi = useMemo(() => {
        let sub = 0, up = 0
        for (const f of auditOverThreshold) {
            const v = f.properties.value_inch
            const a = area(f) * SQM_TO_SQMI
            if (v < 0) sub += a
            else if (v > 0) up += a
        }
        return { subsiding: sub, uplift: up }
    }, [auditOverThreshold])

    const totalFootprintSqMi = useMemo(
        () => filtered.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [filtered]
    )

    const maxDisplacement = useMemo(() => {
        let max = 0
        for (const f of filtered) {
            const v = Math.abs(f.properties.value_inch)
            if (v > max) max = v
        }
        return max
    }, [filtered])

    // Median + p95 |value| over audit-bound features so reviewers see the
    // distribution shape, not just the worst single contour.
    const valueQuantiles = useMemo(() => {
        const vals = auditOverThreshold.map(f => Math.abs(f.properties.value_inch)).sort((a, b) => a - b)
        if (vals.length === 0) return { median: 0, p95: 0 }
        const at = (q: number) => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))]
        return { median: at(0.5), p95: at(0.95) }
    }, [auditOverThreshold])

    const distinctBasins = useMemo(() => new Set(filtered.map(f => f.properties.location)).size, [filtered])

    const period = useMemo(() => {
        const yrs = filtered.map(f => getBucketYear(f.properties)).filter((y): y is string => Boolean(y))
        if (yrs.length === 0) return null
        return { from: yrs.reduce((a, b) => a < b ? a : b), to: yrs.reduce((a, b) => a > b ? a : b) }
    }, [filtered])

    const stackedAreaByYear = useMemo(() => {
        const yearToBins = new Map<string, Record<string, number>>()
        for (const f of scoped) {
            const v = f.properties.value_inch
            if (Math.abs(v) < visualThreshold) continue
            const bin = findBin(plotBins, v)
            if (!bin) continue
            const y = getBucketYear(f.properties)
            if (!y) continue
            if (!yearToBins.has(y)) yearToBins.set(y, {})
            // Negative-sign bins contribute area below zero so subsidence
            // stacks down and uplift stacks up — the chart geometry itself
            // encodes the direction of motion.
            const signed = bin.max <= 0 ? -1 : 1
            const a = area(f) * SQM_TO_SQMI * signed
            const buckets = yearToBins.get(y)!
            buckets[bin.name] = (buckets[bin.name] ?? 0) + a
        }
        return Array.from(yearToBins, ([year, b]) => ({ year, ...b }))
            .sort((a, b) => a.year.localeCompare(b.year))
    }, [scoped, visualThreshold, plotBins])

    // Worst-basin list considers ALL basins (skips the basin filter) so the
    // ranking stays complete; non-selected rows render greyed out when a
    // basin filter is active. Still honors year + threshold + type scope.
    const basinsByDepth = useMemo(() => {
        const yearMatched = (f: DisplacementFeature) => {
            if (!year) return false
            return getBucketYear(f.properties) === year
        }
        const byLocation = new Map<string, { signed: number; abs: number; features: DisplacementFeature[] }>()
        for (const f of features) {
            if (!yearMatched(f)) continue
            const loc = f.properties.location
            if (!loc) continue
            const v = f.properties.value_inch
            const a = Math.abs(v)
            if (a < auditThreshold) continue
            const cur = byLocation.get(loc)
            if (!cur) {
                byLocation.set(loc, { signed: v, abs: a, features: [f] })
            } else {
                cur.features.push(f)
                if (a > cur.abs) {
                    cur.signed = v
                    cur.abs = a
                }
            }
        }
        return Array.from(byLocation, ([location, { signed, abs, features: locFeatures }]) => ({
            location,
            abs,
            features: locFeatures,
            // Precompute bbox once per basin so multi-select zooming combines
            // pre-baked numbers instead of re-walking thousands of coordinates
            // on every click — was tanking the main thread on busy basins.
            bbox: combinedBbox(locFeatures),
            bin: findBin(plotBins, signed),
        })).sort((a, b) => b.abs - a.abs)
    }, [features, year, auditThreshold, plotBins])

    // Use the global worst depth (across this type's entire dataset, ignoring
    // year/threshold) as the row-bar denominator so a basin's bar width keeps
    // the same physical meaning regardless of the active filter. Picking a
    // calm year no longer makes mild basins look maxed out.
    const worstDepth = useMemo(() => {
        let max = 0
        for (const f of features) {
            const a = Math.abs(f.properties.value_inch)
            if (a > max) max = a
        }
        return max
    }, [features])

    const { map } = useMap()
    // Combine precomputed basin bboxes (cheap min/max math) and pan once.
    function zoomToBboxes(bboxes: ([number, number, number, number] | null)[]) {
        if (!map) return
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const bb of bboxes) {
            if (!bb) continue
            if (bb[0] < minX) minX = bb[0]
            if (bb[1] < minY) minY = bb[1]
            if (bb[2] > maxX) maxX = bb[2]
            if (bb[3] > maxY) maxY = bb[3]
        }
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return
        if (minX > maxX || minY > maxY) return
        try {
            // Defer fitBounds to the next frame so it never lands inside an
            // in-flight render. animate:false skips the camera tween entirely,
            // sidestepping MapLibre's 'transition already running' errors when
            // rapid basin toggles queue overlapping fitBounds calls.
            requestAnimationFrame(() => {
                try {
                    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: 12, animate: false })
                } catch (err) {
                    console.warn('zoomToBboxes: fitBounds failed', err, { minX, minY, maxX, maxY })
                }
            })
        } catch (err) {
            console.warn('zoomToBboxes: scheduling failed', err)
        }
    }

    // Per-segment highlight via the Bar `shape` render prop — replaces the
    // deprecated <Cell> children (recharts v3 routes per-datum styling through
    // `shape`). Dims segments outside the active year; Cumulative end-years light
    // every window up to and including the pick, Yearly only the exact match.
    // Only geometry + fill are forwarded to Rectangle so non-DOM Bar props
    // (payload, tooltipPosition, …) can't leak onto the SVG path.
    const renderHighlightBar = (props: BarShapeProps) => {
        const { x, y, width, height, fill } = props
        const yr = props.payload?.year as string | undefined
        const highlighted =
            !year ||
            (yr ? (typeValue === 'Cumulative' ? yr <= year : yr === year) : true)
        return <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={highlighted ? 1 : 0.25} />
    }

    if (isError) return <div className="text-xs text-destructive mb-2">Failed to load stats.</div>

    return (
        <div className="mb-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
                <KPI label="Subsiding Area" value={isLoading ? '—' : `${fmt1(totalAreaSqMi)} mi²`} sub={`|value| ≥ ${fmt1(auditThreshold)} in (SLD default)`} />
                <KPI label="Max |value|" value={isLoading ? '—' : `${fmt1(maxDisplacement)} in`} sub={typeValue} />
                <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
                <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
            </div>

            <AdvancedMetrics
                isLoading={isLoading}
                signedAreaSqMi={signedAreaSqMi}
                totalFootprintSqMi={totalFootprintSqMi}
                quantiles={valueQuantiles}
                auditThreshold={auditThreshold}
            />

            <div>
                <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium">Subsidence &amp; Uplift by {yearAxisLabel}</h4>
                    {yearOverride !== null && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setYearOverride(null)}>
                            Reset to latest
                        </Button>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground mb-1">Bars below zero = subsidence, above = uplift. Stacked by SLD bin (in); breaks + colors match the map. Click a year column to filter to that year.</p>
                {thresholdDirty && (
                    <p className="mb-1 text-[10px] text-amber-600 dark:text-amber-400">
                        Visual threshold {fmt1(visualThreshold)} in differs from SLD default {fmt1(auditThreshold)} in — KPI &amp; metrics above stay pinned to the default.
                    </p>
                )}
                <div className="w-full" style={{ height: CHART_HEIGHT_PX }}>
                    {isLoading ? <Skeleton className="h-full w-full" /> : (
                        // Fixed numeric height so recharts' ResponsiveContainer never
                        // renders at calculatedHeight <= 0 — that path logs a width/height
                        // warning on every mount (recharts v3 logs in prod too). Width
                        // stays responsive at 100%. Wrapper + chart share CHART_HEIGHT_PX
                        // so there's one source of truth for the height.
                        <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
                            <BarChart
                                data={stackedAreaByYear}
                                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                                stackOffset="sign"
                                onClick={(state) => {
                                    const label = state?.activeLabel
                                    if (typeof label === 'string' && label) setYearOverride(label)
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                                <YAxis
                                    stroke="currentColor"
                                    tick={{ fill: 'currentColor', fontSize: 11 }}
                                    width={60}
                                    tickMargin={2}
                                    tickFormatter={(v: number) => `${fmt1(Math.abs(v))} mi²`}
                                >
                                    <RechartsLabel value="↑ Uplift · Subsidence ↓ (mi²)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                </YAxis>
                                <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.5} />
                                <Tooltip
                                    cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                                    content={<StackedBarTooltip />}
                                />
                                {stackedBinOrder.map(bin => (
                                    <Bar key={bin.name} dataKey={bin.name} stackId="rate" fill={bin.color} name={bin.title} shape={renderHighlightBar} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 px-2 text-[10px] text-foreground">
                    <SignedLegendGroup label="Subsidence (below zero)" bins={subsidenceBins} />
                    <SignedLegendGroup label="Uplift (above zero)" bins={upliftBins} />
                </div>
                <p className="mt-1 px-2 text-[10px] italic text-muted-foreground">
                    Bin values: {getUnitsLabelForType(typeValue)}.
                </p>
            </div>

            <BasinList
                basinsByDepth={basinsByDepth}
                basinFilterActive={basinFilterActive}
                selectedBasins={selectedBasins}
                typeValue={typeValue}
                worstDepth={worstDepth}
                isLoading={isLoading}
                addBasin={addBasin}
                removeBasin={removeBasin}
                clearBasins={clearBasins}
                zoomToBboxes={zoomToBboxes}
            />
        </div>
    )
}

interface BasinListProps {
    basinsByDepth: ReadonlyArray<{
        location: string
        abs: number
        features: DisplacementFeature[]
        bbox: [number, number, number, number] | null
        bin: SldBin | undefined
    }>
    basinFilterActive: boolean
    selectedBasins: ReadonlySet<string>
    typeValue: ChartedType
    worstDepth: number
    isLoading: boolean
    addBasin: (type: DisplacementType, location: string) => void
    removeBasin: (type: DisplacementType, location: string) => void
    clearBasins: (type: DisplacementType) => void
    zoomToBboxes: (bboxes: ([number, number, number, number] | null)[]) => void
}

const BASIN_PAGE_SIZE = 10

function BasinList({
    basinsByDepth,
    basinFilterActive,
    selectedBasins,
    typeValue,
    worstDepth,
    isLoading,
    addBasin,
    removeBasin,
    clearBasins,
    zoomToBboxes,
}: BasinListProps) {
    const [page, setPage] = useState(0)
    const total = basinsByDepth.length
    const pageCount = Math.max(1, Math.ceil(total / BASIN_PAGE_SIZE))
    // Clamp on read so a shrinking list (filter / threshold change) can't leave
    // the user stranded on an empty page — no effect, no extra render.
    const safePage = Math.min(page, pageCount - 1)
    const start = safePage * BASIN_PAGE_SIZE
    const end = Math.min(total, start + BASIN_PAGE_SIZE)
    const pageItems = useMemo(() => basinsByDepth.slice(start, end), [basinsByDepth, start, end])

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-medium">Subsidence by Basin</h4>
                {basinFilterActive && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => clearBasins(typeValue)}
                    >
                        Clear filter
                    </Button>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Basins ranked by their deepest contour value. Click a row to zoom + filter to that basin. Unselected basins grey out when a filter is active.</p>
            {isLoading ? (
                <Skeleton className="h-40 w-full" />
            ) : total === 0 ? (
                <p className="text-[11px] text-muted-foreground">No basins above threshold.</p>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        {pageItems.map(b => {
                            const pct = worstDepth > 0 ? (b.abs / worstDepth) * 100 : 0
                            const color = b.bin?.color ?? 'hsl(var(--muted-foreground))'
                            const inFilter = !basinFilterActive || selectedBasins.has(b.location)
                            return (
                                <button
                                    key={b.location}
                                    type="button"
                                    onClick={() => {
                                        // Toggle: click an already-selected basin to remove it.
                                        const wasSelected = selectedBasins.has(b.location)
                                        const nextSelected = new Set(selectedBasins)
                                        if (wasSelected) {
                                            removeBasin(typeValue, b.location)
                                            nextSelected.delete(b.location)
                                        } else {
                                            addBasin(typeValue, b.location)
                                            nextSelected.add(b.location)
                                        }
                                        if (nextSelected.size === 0) return
                                        const bboxes = basinsByDepth
                                            .filter(x => nextSelected.has(x.location))
                                            .map(x => x.bbox)
                                        zoomToBboxes(bboxes)
                                    }}
                                    className={`group grid grid-cols-[1fr_auto] items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60 text-left transition-opacity ${inFilter ? '' : 'opacity-30 hover:opacity-100'}`}
                                    title={selectedBasins.has(b.location) ? `Remove ${b.location} from filter` : `Zoom + filter to ${b.location}`}
                                    aria-pressed={selectedBasins.has(b.location)}
                                >
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="truncate text-[11px] text-foreground group-hover:text-primary">{b.location}</span>
                                        <div className="h-2 w-full rounded bg-muted overflow-hidden ring-1 ring-foreground/20">
                                            <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                                        </div>
                                    </div>
                                    <span className="tabular-nums text-[11px] text-muted-foreground whitespace-nowrap">{fmt1(b.abs)} in</span>
                                </button>
                            )
                        })}
                    </div>
                    {pageCount > 1 && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span className="tabular-nums">{start + 1}–{end} of {total}</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => setPage(Math.max(0, safePage - 1))}
                                    disabled={safePage === 0}
                                >
                                    Prev
                                </Button>
                                <span className="tabular-nums">Page {safePage + 1} / {pageCount}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                                    disabled={safePage >= pageCount - 1}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

// Custom tooltip for the stacked-bar chart: shows the year as header, then a
// colored swatch + bin title + mi² per non-zero stack segment so reviewers can
// see which depth bins contributed to that year without leaving the chart.
interface TooltipEntry {
    name?: string
    value?: number
    color?: string
}
function StackedBarTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number }) {
    if (!active || !payload || payload.length === 0) return null
    // Signed values: subsidence rows arrive negative, uplift positive. Show
    // unsigned magnitudes to the user — direction is already conveyed by which
    // side of zero the bar sits on (and by the row's bin range in its name).
    const rows = payload.filter(p => typeof p.value === 'number' && Math.abs(p.value as number) > 0)
    if (rows.length === 0) return null
    return (
        <div className="rounded border border-border bg-popover px-2 py-1.5 text-[11px] text-popover-foreground shadow-sm">
            <div className="font-medium mb-1">{label}</div>
            <div className="flex flex-col gap-0.5">
                {rows.map(r => (
                    <div key={r.name} className="flex items-center gap-1.5">
                        <span
                            className="inline-block h-2.5 w-2.5 ring-1 ring-foreground/40"
                            style={{ background: r.color }}
                            aria-hidden
                        />
                        <span className="flex-1">{r.name}</span>
                        <span className="tabular-nums">{fmt1(Math.abs((r.value as number) ?? 0))} mi²</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function SignedLegendGroup({ label, bins }: { label: string; bins: SldBin[] }) {
    if (bins.length === 0) return <div />
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            {bins.map(bin => (
                <div key={bin.name} className="flex items-center gap-1.5 min-w-0">
                    <span
                        className="inline-block h-2.5 w-2.5 shrink-0 ring-1 ring-foreground/40"
                        style={{ background: bin.color }}
                        aria-hidden
                    />
                    <span className="truncate">{bin.title}</span>
                </div>
            ))}
        </div>
    )
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card>
            <CardHeader className="p-2 pb-0">
                <CardTitle className="text-[10px] font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <div className="text-sm font-semibold">{value}</div>
                {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
            </CardContent>
        </Card>
    )
}

interface AdvancedMetricsProps {
    isLoading: boolean
    signedAreaSqMi: { subsiding: number; uplift: number }
    totalFootprintSqMi: number
    quantiles: { median: number; p95: number }
    auditThreshold: number
}

// Audit-bound deep-dive numbers. Collapsed by default — reviewers who only
// need the headline KPIs can ignore the section, but anyone QA-ing a basin
// has the distribution shape + asymmetry numbers one click away.
function AdvancedMetrics({ isLoading, signedAreaSqMi, totalFootprintSqMi, quantiles, auditThreshold }: AdvancedMetricsProps) {
    const ratio = signedAreaSqMi.uplift > 0
        ? signedAreaSqMi.subsiding / signedAreaSqMi.uplift
        : null
    const coveragePct = totalFootprintSqMi > 0
        ? (signedAreaSqMi.subsiding / totalFootprintSqMi) * 100
        : 0
    return (
        <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between rounded border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/70">
                <span>Advanced metrics</span>
                <ChevronRightIcon className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <KPI
                        label="Median |value|"
                        value={isLoading ? '—' : `${fmt1(quantiles.median)} in`}
                        sub={`audit ≥ ${fmt1(auditThreshold)} in`}
                    />
                    <KPI
                        label="p95 |value|"
                        value={isLoading ? '—' : `${fmt1(quantiles.p95)} in`}
                        sub="distribution tail"
                    />
                    <KPI
                        label="Subs / Uplift"
                        value={isLoading
                            ? '—'
                            : (ratio === null ? '∞' : ratio.toFixed(2))}
                        sub={`${fmt1(signedAreaSqMi.subsiding)} / ${fmt1(signedAreaSqMi.uplift)} mi²`}
                    />
                    <KPI
                        label="Subsiding coverage"
                        value={isLoading ? '—' : `${coveragePct.toFixed(1)}%`}
                        sub="of feature footprint"
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}
