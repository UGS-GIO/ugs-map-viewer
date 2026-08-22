import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, MapPin, Maximize2 } from 'lucide-react'
import area from '@turf/area'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LegendSwatchGrid, type LegendSwatchItem } from '@/components/maps/legend-swatch-grid'
import { BarChart, Bar, LineChart, Line, Rectangle, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Label as RechartsLabel, useActiveTooltipLabel, useIsTooltipActive, type BarShapeProps, type XAxisTickContentProps } from 'recharts'
import type { LayerContentProps } from '@/components/maps/popups/types'
import { useDisplacementFilters, useEffectiveThresholdsIn, useEffectiveYear } from './displacement-filter-context'
import { useMap } from '@/hooks/use-map'
import { DISPLACEMENT_LAYER_TYPES, getStyleNameForType, getUnitsLabelForType, isChartedType, isDisplacementLayerTitle, type ChartedType, type DisplacementType } from './displacement-layers'
import { binMatches, getZeroBound, magnitudeLabel, type SldBin } from './displacement-sld-legend'
import {
    getBucketYear,
    useDisplacementFeaturesByType,
    useDisplacementSldBins,
    type DisplacementFeature,
} from './use-displacement-queries'
import { deepestSubsidenceByYear } from './displacement-analytics'
import { DisplacementDetailDialog } from './displacement-detail-dialog'

const SQM_TO_SQMI = 1 / 2_589_988.110336

// Stacked-bar chart height in px. Shared by the chart wrapper and recharts'
// ResponsiveContainer so a numeric height (not '100%') is always passed —
// recharts v3 logs a width/height warning when it measures 0 at mount.
const CHART_HEIGHT_PX = 224

// Round to 1 decimal place for popup display.
const fmt1 = (n: number): string => n.toFixed(1)

// One chart column: the year plus a signed mi² total per SLD bin name.
type ChartRow = { year: string; [binName: string]: string | number }

// Stable identity so recharts doesn't see a new content component each render.
const renderNoTooltip = () => null

// Values stay signed so uplift and subsidence can't cancel out in the legend.
function sumByBin(rows: ChartRow[]): Record<string, number> {
    const totals: Record<string, number> = {}
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (key === 'year' || typeof value !== 'number') continue
            totals[key] = (totals[key] ?? 0) + value
        }
    }
    return totals
}

// Columns the active year covers: a range for Cumulative, one for Yearly. Shared
// by the chart's highlight band and the legend's summed readout so they can't drift.
function isYearInRange(typeValue: ChartedType, selected: string | null, yr: string | undefined): boolean {
    if (!selected || !yr) return true
    return typeValue === 'Cumulative' ? yr <= selected : yr === selected
}

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
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <span>Outside Water Year filter</span>
            </div>
        )
    }

    const typeValue = DISPLACEMENT_LAYER_TYPES[title]
    if (!isChartedType(typeValue) || typeValue === 'Cumulative') {
        return (
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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

// Uses each rule's own predicate, so a value lands where GeoServer would paint it.
// Given plot bins (deadband excluded), uncertainty values resolve to no bin.
export function findBin(bins: SldBin[], v: number): SldBin | undefined {
    return bins.find(b => binMatches(b, v))
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
    const { yearOverridesByType, basinsByType, excludedDataQualsByType, addBasin, removeBasin, clearBasins, setYearOverride } = useDisplacementFilters()
    const yearOverride = yearOverridesByType[typeValue]
    // Year is mandatory now (no "all years" sentinel): falls back to the
    // latest available year for this type while the user hasn't picked one.
    const year = useEffectiveYear(typeValue)
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
    // One effective threshold (reviewer override → SLD "Zero" deadband default).
    // Drives the map cql, the stacked bar, and every KPI / metric / basin
    // ranking — one honest knob, applied everywhere.
    const threshold = useEffectiveThresholdsIn()[typeValue]
    const zeroBound = useMemo(() => getZeroBound(sldBins), [sldBins])
    // One test behind KPI, chart, and basin ranking: clear the reviewer's floor
    // AND land in a band the map paints. Keeps all three agreeing with the map.
    const isMeasured = useCallback(
        (v: number) => Math.abs(v) >= threshold && findBin(plotBins, v) !== undefined,
        [threshold, plotBins]
    )
    const thresholdLabel = zeroBound != null && threshold <= zeroBound
        ? `|value| > ${fmt1(zeroBound)} in`
        : `|value| ≥ ${fmt1(threshold)} in`

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

    // Data-quality filter: drop features whose data_qual the reviewer unchecked.
    // Empty exclusion set = pass everything. Applied before basin/year scoping so
    // KPIs, chart, and the basin ranking all honor it (matching the map cql).
    const excludedQuals = excludedDataQualsByType[typeValue]
    const qualFiltered = useMemo(
        () => excludedQuals.size === 0
            ? features
            : features.filter(f => !excludedQuals.has(String(f.properties.data_qual ?? ''))),
        [features, excludedQuals]
    )

    // `qualFiltered` is typeValue-sliced + quality-filtered. Empty basin set = all basins.
    const scoped = useMemo(
        () => selectedBasins.size === 0
            ? qualFiltered
            : qualFiltered.filter(f => selectedBasins.has(f.properties.location)),
        [qualFiltered, selectedBasins]
    )

    // Deepest MEASURED subsidence (in) per closing year for the current scope —
    // the depth-over-time series. Gated through `isMeasured` so it honors the
    // threshold and excludes the SLD "Zero" deadband exactly like the KPIs,
    // stacked bars, and basin ranking (one honest knob everywhere). Pre-filtered
    // to subsidence (value_inches < 0) so an uplift-only year can't plot a
    // misleading 0. Uses all years (not the year filter): a trend needs the
    // whole record, not just the selected year.
    const depthByYear = useMemo(
        () => Array.from(
            deepestSubsidenceByYear(scoped.filter(f => f.properties.value_inches < 0 && isMeasured(f.properties.value_inches))),
            ([yr, depthIn]) => ({ year: yr, depthIn }),
        ).sort((a, b) => a.year.localeCompare(b.year)),
        [scoped, isMeasured],
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

    // KPI + advanced metrics use the single SLD-pinned threshold.
    const auditOverThreshold = useMemo(
        () => filtered.filter(f => isMeasured(f.properties.value_inches)),
        [filtered, isMeasured]
    )

    const totalAreaSqMi = useMemo(
        () => auditOverThreshold.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [auditOverThreshold]
    )

    const maxDisplacement = useMemo(() => {
        let max = 0
        for (const f of filtered) {
            const v = Math.abs(f.properties.value_inches)
            if (v > max) max = v
        }
        return max
    }, [filtered])

    const distinctBasins = useMemo(() => new Set(filtered.map(f => f.properties.location)).size, [filtered])

    // Period spans the full window: earliest window-start year → latest window-end
    // year. For Cumulative this reads start_date (fixed 2017) through the chosen
    // end year (e.g. picking 2020 → "2017 – 2020", the whole accumulation window),
    // not just the end. Yearly naturally shows its single open→close year span.
    const period = useMemo(() => {
        const ends = filtered.map(f => getBucketYear(f.properties)).filter((y): y is string => Boolean(y))
        if (ends.length === 0) return null
        const starts = filtered
            .map(f => f.properties.start_date?.slice(0, 4))
            .filter((y): y is string => Boolean(y))
        const from = (starts.length ? starts : ends).reduce((a, b) => a < b ? a : b)
        const to = ends.reduce((a, b) => a > b ? a : b)
        return { from, to }
    }, [filtered])

    const stackedAreaByYear = useMemo(() => {
        const yearToBins = new Map<string, Record<string, number>>()
        for (const f of scoped) {
            const v = f.properties.value_inches
            if (!isMeasured(v)) continue
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
        return Array.from(yearToBins, ([year, b]): ChartRow => ({ year, ...b }))
            .sort((a, b) => a.year.localeCompare(b.year))
    }, [scoped, isMeasured, plotBins])

    // Bin names that actually contribute a non-zero segment somewhere in the
    // currently plotted years — drives the under-chart legend so reviewers
    // only see swatches for ranges present in view, not every possible SLD
    // class.
    const presentBinNames = useMemo(() => {
        const names = new Set<string>()
        for (const row of stackedAreaByYear) {
            for (const [key, value] of Object.entries(row)) {
                if (key === 'year') continue
                if (typeof value === 'number' && value !== 0) names.add(key)
            }
        }
        return names
    }, [stackedAreaByYear])

    const visibleUpliftBins = useMemo(
        () => upliftBins.filter(b => presentBinNames.has(b.name)),
        [upliftBins, presentBinNames]
    )
    const visibleSubsidenceBins = useMemo(
        () => subsidenceBins.filter(b => presentBinNames.has(b.name)),
        [subsidenceBins, presentBinNames]
    )

    // Worst-basin list considers ALL basins (skips the basin filter) so the
    // ranking stays complete; non-selected rows render greyed out when a
    // basin filter is active. Still honors year + threshold + type scope.
    const basinsByDepth = useMemo(() => {
        const yearMatched = (f: DisplacementFeature) => {
            if (!year) return false
            return getBucketYear(f.properties) === year
        }
        const byLocation = new Map<string, { signed: number; abs: number; features: DisplacementFeature[] }>()
        for (const f of qualFiltered) {
            if (!yearMatched(f)) continue
            const loc = f.properties.location
            if (!loc) continue
            const v = f.properties.value_inches
            const a = Math.abs(v)
            if (!isMeasured(v)) continue
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
    }, [qualFiltered, year, isMeasured, plotBins])

    // Use the global worst depth (across this type's entire dataset, ignoring
    // year/threshold) as the row-bar denominator so a basin's bar width keeps
    // the same physical meaning regardless of the active filter. Picking a
    // calm year no longer makes mild basins look maxed out.
    const worstDepth = useMemo(() => {
        let max = 0
        for (const f of qualFiltered) {
            const a = Math.abs(f.properties.value_inches)
            if (a > max) max = a
        }
        return max
    }, [qualFiltered])

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

    // Hover feeds the legend instead of a floating card — the panel is too narrow
    // for a tooltip beside the bar without clipping.
    const [hoveredYear, setHoveredYear] = useState<string | null>(null)
    // Pop-out ("Expand") for the full depth + area detail in a wider modal.
    const [detailOpen, setDetailOpen] = useState(false)

    // Independent of hover, so the range readout survives pointer movement.
    const rangeRows = useMemo(
        () => year ? stackedAreaByYear.filter(r => isYearInRange(typeValue, year, r.year)) : [],
        [stackedAreaByYear, year, typeValue]
    )
    const hoveredRow = useMemo(
        () => hoveredYear ? stackedAreaByYear.find(r => r.year === hoveredYear) ?? null : null,
        [stackedAreaByYear, hoveredYear]
    )

    const rangeTotals = useMemo(() => sumByBin(rangeRows), [rangeRows])

    // Two columns only past one year, else both would print the same number.
    const isRangeMode = rangeRows.length > 1

    const legendSpan = useMemo(() => {
        if (isRangeMode) return `${rangeRows[0].year}–${rangeRows[rangeRows.length - 1].year}`
        return hoveredYear ?? year
    }, [isRangeMode, rangeRows, hoveredYear, year])

    // Magnitudes only — the Uplift/Subsidence split already carries direction.
    const fmtArea = (v: number | undefined): string => v ? fmt1(Math.abs(v)) : '—'

    // Range mode puts the unit in the header; single-column keeps it inline.
    const legendValueFor = (binName: string): string | undefined => {
        if (isRangeMode) return fmtArea(rangeTotals[binName])
        const row = hoveredRow ?? rangeRows[0]
        if (!row) return undefined
        const v = row[binName]
        return typeof v === 'number' && v !== 0 ? `${fmt1(Math.abs(v))} mi²` : '—'
    }

    // Em dash while idle so the column doesn't appear and vanish under the pointer.
    const legendHoverValueFor = (binName: string): string | undefined => {
        if (!isRangeMode) return undefined
        if (!hoveredRow) return '—'
        const v = hoveredRow[binName]
        return typeof v === 'number' && v !== 0 ? fmt1(Math.abs(v)) : '—'
    }

    const selectYear = useCallback(
        (label: string) => setYearOverride(typeValue, label),
        [setYearOverride, typeValue]
    )

    if (isError) return <div className="text-xs text-destructive mb-2">Failed to load stats.</div>

    return (
        <div className="mb-3 flex flex-col gap-3 px-2 py-1">
            {/* Scope bar: statewide by default, or the drilled-in basin(s) with a
                one-click way back. The Subsidence-by-Basin ranking below is the
                drill-in entry point (click a row to scope everything to it). */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-xs" aria-live="polite">
                    <MapPin className={`h-3 w-3 shrink-0 ${basinFilterActive ? 'text-foreground' : 'text-muted-foreground'}`} aria-hidden="true" />
                    {basinFilterActive ? (
                        <span className="truncate font-medium text-foreground" title={[...selectedBasins].join(', ')}>
                            {selectedBasins.size === 1 ? [...selectedBasins][0] : `${selectedBasins.size} basins`}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">Statewide</span>
                    )}
                </div>
                {basinFilterActive && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => {
                            // "Back to statewide" restores the statewide view,
                            // camera included — fit to the extent of all basins
                            // (basinsByDepth ignores the basin filter, so it always
                            // holds every basin). Drill-in zooms in; this zooms back
                            // out. Deselecting the last basin via a ranking row stays
                            // filter-only — a per-basin toggle, not an explicit
                            // "go statewide" action.
                            clearBasins(typeValue)
                            zoomToBboxes(basinsByDepth.map(b => b.bbox))
                        }}
                    >
                        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                        Back to statewide
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <KPI label="Subsiding Area" value={isLoading ? '—' : `${fmt1(totalAreaSqMi)} mi²`} sub={thresholdLabel} />
                <KPI label="Max |value|" value={isLoading ? '—' : `${fmt1(maxDisplacement)} in`} sub={typeValue} />
                <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
                <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
            </div>

            {/* Ranking sits right under the summary — it's the statewide "which
                basins" answer and the drill-in entry point. The time-series
                detail (depth, extent) follows below, master/detail style. */}
            <BasinList
                basinsByDepth={basinsByDepth}
                basinFilterActive={basinFilterActive}
                selectedBasins={selectedBasins}
                typeValue={typeValue}
                worstDepth={worstDepth}
                isLoading={isLoading}
                addBasin={addBasin}
                removeBasin={removeBasin}
                zoomToBboxes={zoomToBboxes}
            />

            <div>
                <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium">Subsidence depth by {yearAxisLabel}</h4>
                    <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setDetailOpen(true)}>
                        Expand <Maximize2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                    Deepest measured subsidence each {yearAxisLabel.toLowerCase()}, in inches — honors the threshold and data-quality filters.
                    {typeValue === 'Yearly' && ' The first year carries the multi-year baseline, not a single-year change.'}
                </p>
                {/* TODO(ALL-5673): rebaseline/mark the Yearly seed year instead of only captioning it — belongs with the pop-out step of the redesign. */}
                <div className="w-full [&_.recharts-surface]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none" style={{ height: CHART_HEIGHT_PX }}>
                    {isLoading ? <Skeleton className="h-full w-full" /> : (
                        <DepthByYearChart data={depthByYear} lineColor={subsidenceBins[subsidenceBins.length - 1]?.color ?? 'currentColor'} />
                    )}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium">Uplift &amp; Subsidence by {yearAxisLabel}</h4>
                    {yearOverride !== null && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setYearOverride(typeValue, null)}>
                            Reset to latest
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">Bars above zero = uplift, below zero = subsidence. Stacked by displacement range (in); colors match the map. Hover a column to read its per-range areas in the legend below; click to filter to that year — the shaded column is the active {yearAxisLabel.toLowerCase()}.</p>
                <div
                    // Recharts focuses the SVG on click, which Chrome counts as
                    // focus-visible — any ring here fires on every mouse click.
                    className="w-full [&_.recharts-surface]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none"
                    style={{ height: CHART_HEIGHT_PX }}
                >
                    {isLoading ? <Skeleton className="h-full w-full" /> : (
                        <StackedYearChart
                            data={stackedAreaByYear}
                            bins={stackedBinOrder}
                            year={year}
                            typeValue={typeValue}
                            onHover={setHoveredYear}
                            onSelectYear={selectYear}
                        />
                    )}
                </div>
                {(visibleUpliftBins.length > 0 || visibleSubsidenceBins.length > 0) && (
                    <div className="mt-2 flex flex-col gap-1 px-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vertical Displacement</div>
                        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                            <span>
                                {legendSpan ? <>Area by range · <span className="font-medium text-foreground">{legendSpan}</span>{!isRangeMode && hoveredYear ? ' (hovered)' : ''}</> : 'Area by range'}
                            </span>
                            {isRangeMode && <span>mi²</span>}
                        </div>
                        {isRangeMode ? (
                            <>
                                {/* Captions match LegendSwatchGrid's two numeric columns. */}
                                <div className="flex items-baseline text-[10px] uppercase tracking-wide text-muted-foreground">
                                    <span className="ml-auto shrink-0 pl-1 min-w-[4.25rem] text-right">range</span>
                                    <span className="shrink-0 pl-2 min-w-[4.25rem] text-right">{hoveredYear ?? 'hover'}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <ChartLegendGroup label="Uplift" bins={visibleUpliftBins} valueFor={legendValueFor} secondaryValueFor={legendHoverValueFor} />
                                    <ChartLegendGroup label="Subsidence" bins={visibleSubsidenceBins} valueFor={legendValueFor} secondaryValueFor={legendHoverValueFor} />
                                </div>
                            </>
                        ) : (
                            <div className="grid grid-cols-2 gap-x-3">
                                <ChartLegendGroup label="Uplift" bins={visibleUpliftBins} valueFor={legendValueFor} />
                                <ChartLegendGroup label="Subsidence" bins={visibleSubsidenceBins} valueFor={legendValueFor} />
                            </div>
                        )}
                    </div>
                )}
                <p className="mt-2 px-2 text-xs italic text-muted-foreground">
                    Units: {getUnitsLabelForType(typeValue)}.
                </p>
            </div>

            {detailOpen && (
                <DisplacementDetailDialog
                    open={detailOpen}
                    onOpenChange={setDetailOpen}
                    typeValue={typeValue}
                    scoped={scoped}
                    threshold={threshold}
                    plotBins={plotBins}
                    lineColor={subsidenceBins[subsidenceBins.length - 1]?.color ?? 'currentColor'}
                    yearAxisLabel={yearAxisLabel}
                />
            )}
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
            <h4 className="text-xs font-medium mb-1">Subsidence by Basin</h4>
            <p className="text-xs text-muted-foreground mb-2">Basins ranked by their deepest contour value. Click a row to drill the panel into that basin; unselected rows grey out while one is active. "Back to statewide" up top clears the selection.</p>
            {isLoading ? (
                <Skeleton className="h-40 w-full" />
            ) : total === 0 ? (
                <p className="text-xs text-muted-foreground">No basins above threshold.</p>
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
                                        <span className="truncate text-xs text-foreground">{b.location}</span>
                                        <div className="h-2 w-full rounded bg-muted overflow-hidden ring-1 ring-foreground/20">
                                            <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                                        </div>
                                    </div>
                                    <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">{fmt1(b.abs)} in</span>
                                </button>
                            )
                        })}
                    </div>
                    {pageCount > 1 && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{start + 1}–{end} of {total}</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => setPage(Math.max(0, safePage - 1))}
                                    disabled={safePage === 0}
                                >
                                    Prev
                                </Button>
                                <span className="tabular-nums">Page {safePage + 1} / {pageCount}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
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

interface StackedYearChartProps {
    data: ChartRow[]
    bins: SldBin[]
    year: string | null
    typeValue: ChartedType
    onHover: (year: string | null) => void
    onSelectYear: (year: string) => void
}

// Memoized: the parent re-renders per hover to refresh the legend, and dragging
// this subtree along cost ~160ms a column. No prop here changes while hovering.
const StackedYearChart = memo(function StackedYearChart({ data, bins, year, typeValue, onHover, onSelectYear }: StackedYearChartProps) {
    const isHighlightedYear = (yr: string | undefined) => isYearInRange(typeValue, year, yr)

    // Per-segment highlight via the Bar `shape` render prop — recharts v3 routes
    // per-datum styling through `shape` rather than the deprecated <Cell>. The dim
    // on off-year segments is deliberately mild: the band below marks the
    // selection, and a heavier dim washes them out against the light theme.
    // Only geometry + fill reach Rectangle so non-DOM Bar props can't leak onto
    // the SVG path.
    const renderHighlightBar = (props: BarShapeProps) => {
        const { x, y, width, height, fill } = props
        const highlighted = isHighlightedYear(props.payload?.year as string | undefined)
        return <Rectangle x={x} y={y} width={width} height={height} fill={fill} fillOpacity={highlighted ? 1 : 0.45} />
    }

    // Full-height tint band behind the active year's column(s). Opacity alone
    // can't mark a selection whose segments are a pixel tall (calm years, high
    // threshold) — there's nothing to dim. Fill only: a stroke reads as a box
    // drawn around every bar once a Cumulative range spans several columns.
    const renderYearBand = (props: BarShapeProps) => {
        const { x, y, width, height } = props
        if (!year || !isHighlightedYear(props.payload?.year as string | undefined)) return <g />
        return <Rectangle x={x} y={y} width={width} height={height} fill="currentColor" fillOpacity={0.1} />
    }

    // Bold + full-contrast tick for the selected year, muted for the rest — a
    // second read of the pick (exact match even for Cumulative, where the band
    // covers the whole accumulation window up to that year).
    const renderYearTick = (props: XAxisTickContentProps) => {
        const value = String(props.payload?.value ?? '')
        const selected = value === year
        return (
            <text
                x={props.x}
                y={props.y}
                dy={11}
                textAnchor="middle"
                fill="currentColor"
                fontSize={11}
                fontWeight={selected ? 700 : 400}
                fillOpacity={selected ? 1 : 0.6}
            >
                {value}
            </text>
        )
    }

    return (
        // Fixed numeric height so recharts' ResponsiveContainer never renders at
        // calculatedHeight <= 0 — that path logs a width/height warning on every
        // mount (recharts v3 logs in prod too). Width stays responsive at 100%.
        <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
            <BarChart
                data={data}
                margin={{ top: 16, right: 4, bottom: 0, left: 0 }}
                stackOffset="sign"
                onClick={(state) => {
                    const label = state?.activeLabel
                    if (typeof label === 'string' && label) onSelectYear(label)
                }}
                style={{ cursor: 'pointer' }}
            >
                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="currentColor" tick={renderYearTick} height={20} />
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
                <HoveredYearReporter onHover={onHover} />
                {/* Kept for the column highlight; the readout lives in the legend. */}
                <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} content={renderNoTooltip} />
                {bins.map((bin, i) => (
                    <Bar
                        key={bin.name}
                        dataKey={bin.name}
                        stackId="rate"
                        fill={bin.color}
                        name={bin.title}
                        shape={renderHighlightBar}
                        // First stack member only — every Bar in the stack paints the
                        // same full-height background rect, so leaving it on all of
                        // them just stacks identical bands on each other.
                        background={i === 0 ? renderYearBand : undefined}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    )
})

interface DepthPoint { year: string; depthIn: number }

// Depth-over-time line: deepest subsidence (in) per year for the current scope.
// The clean, monotonic read of "how deep, and getting deeper" that the stacked
// area (which encodes affected extent, not depth) can't show. ALL-5673 step 1;
// the stack moves into the pop-out as exceedance lines in a later step.
// Memoized like its sibling StackedYearChart: the parent re-renders on every
// hover of the stacked chart (to refresh the legend), and both props here are
// stable, so memo makes those hover re-renders a no-op.
const DepthByYearChart = memo(function DepthByYearChart({ data, lineColor }: { data: DepthPoint[]; lineColor: string }) {
    return (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
            <LineChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                <YAxis
                    stroke="currentColor"
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    width={52}
                    tickMargin={2}
                    tickFormatter={(v: number) => `${fmt1(v)} in`}
                >
                    <RechartsLabel value="Subsidence (in)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip
                    cursor={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
                    contentStyle={{ fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, color: 'hsl(var(--popover-foreground))' }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    formatter={(value) => [`${fmt1(Number(value))} in`, 'Deepest subsidence']}
                />
                <Line type="monotone" dataKey="depthIn" stroke={lineColor} strokeWidth={2} dot={{ r: 2, fill: lineColor }} activeDot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    )
})

// Renders nothing — reports the hovered column to the parent. The recharts
// hooks only resolve inside <BarChart>, so reading hover state means living in
// the tree; the effect keeps the parent's setState out of render.
function HoveredYearReporter({ onHover }: { onHover: (year: string | null) => void }) {
    const isActive = useIsTooltipActive()
    const label = useActiveTooltipLabel()
    const hovered = isActive && typeof label === 'string' ? label : null

    useEffect(() => {
        onHover(hovered)
    }, [hovered, onHover])

    return null
}

// Under-chart legend group (Uplift / Subsidence column). Only ever receives
// bins that actually contributed a segment to the currently plotted years
// (see `presentBinNames` above) — a full static legend of every SLD class
// regardless of what's on screen duplicates the layer's separate Legend tab
// for no benefit; this one only shows what a reviewer can actually see.
function ChartLegendGroup({ label, bins, valueFor, secondaryValueFor }: { label: string; bins: SldBin[]; valueFor?: (binName: string) => string | undefined; secondaryValueFor?: (binName: string) => string | undefined }) {
    if (bins.length === 0) return null
    const items: LegendSwatchItem[] = bins.map(b => ({
        key: b.name,
        label: magnitudeLabel(b),
        color: b.color,
        value: valueFor?.(b.name),
        secondaryValue: secondaryValueFor?.(b.name),
    }))
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <LegendSwatchGrid items={items} columns="single" />
        </div>
    )
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card>
            <CardHeader className="p-2 pb-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <div className="text-sm font-semibold">{value}</div>
                {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
            </CardContent>
        </Card>
    )
}
