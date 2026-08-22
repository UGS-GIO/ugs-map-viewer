import { useCallback, useMemo } from 'react'
import area from '@turf/area'
import { useDisplacementFilters } from './displacement-filter-context'
import {
    useDisplacementFeaturesByType,
    useDisplacementSldBins,
    type DisplacementFeature,
} from './use-displacement-queries'
import { getShortUnitForType, getStyleNameForType } from './displacement-layers'
import { BasinList, KPI, combinedBbox, findBin, useZoomToBboxes } from './displacement-layer-charts'

// Vertical Displacement Rate is a velocity snapshot (in/year over each basin's
// full record), not a per-year time series — so it gets a lean stats panel:
// KPIs + a by-basin ranking, no depth-over-time / stacked-year charts and no
// user threshold (the SLD "within uncertainty" deadband is the only floor).

const RATE_TYPE = 'Vertical Displacement Rate' as const
const SQM_TO_SQMI = 1 / 2_589_988.110336
const fmt1 = (n: number): string => n.toFixed(1)
// Rate magnitudes are small (SLD bands start at 0.075 in/yr), so two decimals.
const fmt2 = (n: number): string => n.toFixed(2)

export function DisplacementRateStats() {
    const { basinsByType, excludedDataQualsByType, addBasin, removeBasin } = useDisplacementFilters()
    const selectedBasins = basinsByType[RATE_TYPE]
    const basinFilterActive = selectedBasins.size > 0
    const zoomToBboxes = useZoomToBboxes()

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

    return (
        <div className="mb-3 flex flex-col gap-3 px-2 py-1">
            <div className="grid grid-cols-2 gap-2">
                <KPI label="Max rate" value={isLoading ? '—' : `${fmt2(maxRate)} ${unit}`} sub="fastest basin" />
                <KPI label="Measured area" value={isLoading ? '—' : `${fmt1(totalAreaSqMi)} mi²`} sub="above deadband" />
                <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
                <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
            </div>

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
        </div>
    )
}
