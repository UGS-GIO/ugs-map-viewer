import { useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, MapPin } from 'lucide-react'
import area from '@turf/area'
import { Button } from '@/components/ui/button'
import { useDisplacementFilters } from './displacement-filter-context'
import {
    useDisplacementFeaturesByType,
    useDisplacementSldBins,
    type DisplacementFeature,
} from './use-displacement-queries'
import { getShortUnitForType, getStyleNameForType } from './displacement-layers'
import { BasinList, KPI, combinedBbox, findBin, useZoomToBboxes } from './displacement-layer-charts'
import { DisplacementAnalysisLayout } from './displacement-analysis-layout'
import { renderDisplacementLayerFilters } from './displacement-layer-filters'

// Vertical Displacement Rate is a velocity snapshot (in/year over each basin's
// full record), not a per-year time series — so it gets a lean stats panel:
// KPIs + a by-basin ranking, no depth-over-time / stacked-year charts and no
// user threshold (the SLD "within uncertainty" deadband is the only floor).

const RATE_TYPE = 'Vertical Displacement Rate' as const
const SQM_TO_SQMI = 1 / 2_589_988.110336
const fmt1 = (n: number): string => n.toFixed(1)
// Rate magnitudes are small (SLD bands start at 0.075 in/yr), so two decimals.
const fmt2 = (n: number): string => n.toFixed(2)

// `mode='panel'` (default) is the compact sidebar column; `mode='analysis'` is the
// body of the wide pop-out (rendered by DisplacementAnalysisHost) — same KPIs +
// ranking, no charts (Rate is a snapshot), and no scope bar (the pop-out header
// carries the surface switch).
export function DisplacementRateStats({ layerTitle, mode = 'panel' }: { layerTitle: string; mode?: 'panel' | 'analysis' }) {
    const { basinsByType, excludedDataQualsByType, addBasin, removeBasin, clearBasins } = useDisplacementFilters()
    const selectedBasins = basinsByType[RATE_TYPE]
    const basinFilterActive = selectedBasins.size > 0
    const zoomToBboxes = useZoomToBboxes()
    const scopeLabelRef = useRef<HTMLDivElement>(null)

    const styleName = getStyleNameForType(RATE_TYPE) ?? ''
    const { data: features = [], isLoading: featuresLoading } = useDisplacementFeaturesByType(RATE_TYPE)
    const { data: sldBins = [], isLoading: binsLoading } = useDisplacementSldBins(styleName)
    const isLoading = featuresLoading || binsLoading
    const plotBins = useMemo(() => sldBins.filter(b => !b.isZero), [sldBins])

    // Subsidence only, above the SLD deadband (plotBins excludes the "within
    // uncertainty" band, so a bin match already means the rate clears it) — the
    // same honesty floor the map paints. No user-tunable threshold for rate.
    const isMeasured = useCallback(
        (v: number) => v < 0 && findBin(plotBins, v) !== undefined,
        [plotBins],
    )

    const excludedQuals = excludedDataQualsByType[RATE_TYPE]
    const qualFiltered = useMemo(
        () => excludedQuals.size === 0
            ? features
            : features.filter(f => !excludedQuals.has(String(f.properties.data_qual ?? ''))),
        [features, excludedQuals],
    )
    // Basin-scoped view drives the KPIs; the ranking below intentionally ignores
    // the basin filter so it stays complete (matching the charted BasinList).
    const scoped = useMemo(
        () => selectedBasins.size === 0
            ? qualFiltered
            : qualFiltered.filter(f => selectedBasins.has(f.properties.location)),
        [qualFiltered, selectedBasins],
    )
    const measuredScoped = useMemo(
        () => scoped.filter(f => isMeasured(f.properties.value_inches)),
        [scoped, isMeasured],
    )

    const maxRate = useMemo(() => {
        let m = 0
        for (const f of measuredScoped) {
            const a = Math.abs(f.properties.value_inches)
            if (a > m) m = a
        }
        return m
    }, [measuredScoped])

    const totalAreaSqMi = useMemo(
        () => measuredScoped.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [measuredScoped],
    )

    const distinctBasins = useMemo(
        () => new Set(measuredScoped.map(f => f.properties.location)).size,
        [measuredScoped],
    )

    const period = useMemo(() => {
        const starts = scoped.map(f => f.properties.start_date?.slice(0, 4)).filter((y): y is string => Boolean(y))
        const ends = scoped.map(f => f.properties.end_date?.slice(0, 4)).filter((y): y is string => Boolean(y))
        if (!starts.length && !ends.length) return null
        const from = (starts.length ? starts : ends).reduce((a, b) => (a < b ? a : b))
        const to = (ends.length ? ends : starts).reduce((a, b) => (a > b ? a : b))
        return { from, to }
    }, [scoped])

    // Deepest (fastest) subsidence rate per basin, over ALL basins (skips the
    // basin filter like the charted ranking); precompute bbox per basin so the
    // click-to-zoom combines baked numbers instead of re-walking coordinates.
    const basinsByRate = useMemo(() => {
        const byLoc = new Map<string, { abs: number; signed: number; features: DisplacementFeature[] }>()
        for (const f of qualFiltered) {
            const v = f.properties.value_inches
            if (!isMeasured(v)) continue
            const loc = f.properties.location
            if (!loc) continue
            const a = Math.abs(v)
            const cur = byLoc.get(loc)
            if (!cur) byLoc.set(loc, { abs: a, signed: v, features: [f] })
            else {
                cur.features.push(f)
                if (a > cur.abs) { cur.abs = a; cur.signed = v }
            }
        }
        return Array.from(byLoc, ([location, { abs, signed, features: locFeatures }]) => ({
            location,
            abs,
            features: locFeatures,
            bbox: combinedBbox(locFeatures),
            bin: findBin(plotBins, signed),
        })).sort((a, b) => b.abs - a.abs)
    }, [qualFiltered, isMeasured, plotBins])

    // Bar-width denominator: the fastest rate across the whole dataset, so a
    // basin's bar keeps the same physical meaning regardless of the active filter.
    const worstRate = useMemo(() => {
        let m = 0
        for (const f of qualFiltered) {
            const v = f.properties.value_inches
            if (v >= 0) continue
            const a = Math.abs(v)
            if (a > m) m = a
        }
        return m
    }, [qualFiltered])

    const unit = getShortUnitForType(RATE_TYPE)

    // KPIs + ranking built once, reused in the sidebar column and the "Expand"
    // analysis view (no charts — Rate is a snapshot, not a time series).
    const kpiCards = (
        <>
            <KPI label="Max rate" value={isLoading ? '—' : `${fmt2(maxRate)} ${unit}`} sub="fastest basin" />
            <KPI label="Subsiding Area" value={isLoading ? '—' : `${fmt1(totalAreaSqMi)} mi²`} sub="above deadband" />
            <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
            <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
        </>
    )
    const rankingNode = (
        <BasinList
            basinsByDepth={basinsByRate}
            basinFilterActive={basinFilterActive}
            selectedBasins={selectedBasins}
            typeValue={RATE_TYPE}
            worstDepth={worstRate}
            isLoading={isLoading}
            addBasin={addBasin}
            removeBasin={removeBasin}
            zoomToBboxes={zoomToBboxes}
            unit={unit}
            formatValue={fmt2}
            heading="Subsidence rate by basin"
            caption="Basins ranked by their fastest subsidence rate. Click a row to filter + zoom to that basin; unselected rows grey out while one is active."
            emptyText="No basins above the rate deadband."
        />
    )
    const scope = basinFilterActive
        ? (selectedBasins.size === 1 ? [...selectedBasins][0] : `${selectedBasins.size} basins`)
        : 'Statewide'
    const scopeSummary = `${scope} · Rate${period ? ` · ${period.from}–${period.to}` : ''}`

    // Wide pop-out body: KPIs + basin-rate ranking, no charts (Rate is a snapshot).
    // The host owns the Dialog + surface switch + scope summary.
    if (mode === 'analysis') {
        return (
            <DisplacementAnalysisLayout
                scopeSummary={scopeSummary}
                filtersSlot={renderDisplacementLayerFilters(layerTitle)}
                kpisSlot={<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{kpiCards}</div>}
                rankingSlot={rankingNode}
            />
        )
    }

    // One-sentence, scope-aware read — rate is a velocity snapshot, so it reads
    // "subsiding at up to X in/year", not a cumulative depth.
    // The ranking ignores the basin filter (stays complete), so its top entry is
    // the STATEWIDE fastest basin — drop the "· basin" suffix when drilled into one
    // (the summary already names it, and the hero number is scope-filtered).
    const fastestBasin = basinFilterActive && selectedBasins.size === 1 ? undefined : basinsByRate[0]?.location
    const whereText = basinFilterActive && selectedBasins.size === 1
        ? [...selectedBasins][0]
        : `${distinctBasins} ${distinctBasins === 1 ? 'basin' : 'basins'}`
    let summaryLine: string
    if (isLoading) summaryLine = 'Loading…'
    else if (distinctBasins === 0) summaryLine = 'No basins above the rate deadband in the current filters.'
    else summaryLine = `Land in ${whereText} is subsiding at up to ${fmt2(maxRate)} in/year — about ${fmt1(totalAreaSqMi)} mi² is subsiding now.`

    return (
        <div className="mb-3 flex flex-col gap-3 px-2 py-1">
            {/* Scope bar: statewide by default, or the drilled-in basin(s) with a
                one-click way back — mirrors the charted panels so the surfaces stay
                consistent. The by-basin ranking below is the drill-in entry point
                (click a row to scope the KPIs + zoom to that basin). */}
            <div className="flex items-center justify-between gap-2">
                <div ref={scopeLabelRef} tabIndex={-1} className="flex min-w-0 items-center gap-1.5 text-xs focus:outline-none" aria-live="polite">
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
                            // "Back to statewide": clear the filter and zoom the
                            // camera back out to every basin's extent (basinsByRate
                            // ignores the basin filter, so it always holds them all).
                            clearBasins(RATE_TYPE)
                            zoomToBboxes(basinsByRate.map(b => b.bbox))
                            scopeLabelRef.current?.focus()
                        }}
                    >
                        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                        Back to statewide
                    </Button>
                )}
            </div>

            {/* Plain-language summary — the whole panel in one sentence. */}
            <p className="text-sm leading-snug text-foreground">{summaryLine}</p>

            {/* Rate is the hero: how fast the ground is moving. No time chart —
                rate is a single snapshot over each basin's record. */}
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-foreground">{isLoading || distinctBasins === 0 ? '—' : fmt2(maxRate)}</span>
                <span className="text-xs text-muted-foreground">in/year fastest{fastestBasin ? ` · ${fastestBasin}` : ''}</span>
            </div>

            {/* Extent as one number — the map beside the panel shows where. */}
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">{isLoading || distinctBasins === 0 ? '—' : fmt1(totalAreaSqMi)}</span>
                    <span className="text-xs text-muted-foreground">mi² subsiding · above the rate deadband</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Where it's sinking is shaded on the map.</p>
            </div>

            {/* Worst basins — the intuitive ranking + drill-in entry point. */}
            {rankingNode}
        </div>
    )
}
