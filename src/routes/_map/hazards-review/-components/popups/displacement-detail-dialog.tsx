import { memo, useMemo, useState } from 'react'
import area from '@turf/area'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label as RechartsLabel } from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { deepestSubsidenceByYear, subsidedAreaByYear } from './displacement-analytics'
import { binMatches, type SldBin } from './displacement-sld-legend'
import { getBinBoundaries } from './displacement-thresholds'
import type { ChartedType } from './displacement-layers'
import type { DisplacementFeature } from './use-displacement-queries'

// The "Expand" pop-out: the full displacement detail for one charted type in a
// wider modal than the sidebar allows. Depth over time on top, affected area
// below, the two panels sharing one time axis (recharts `syncId`) so a hover on
// either lines the other up. ALL-5673 step D. Reuses the same tested analytics +
// the same threshold/deadband gate as the sidebar so every number agrees.

const SQM_TO_SQMI = 1 / 2_589_988.110336
const PANEL_HEIGHT_PX = 200
const fmt1 = (n: number): string => n.toFixed(1)

// Local, dependency-light bin lookup — a copy of displacement-layer-charts'
// `findBin`, inlined here so this module doesn't import that one (which imports
// this, for the trigger button — a cycle).
function findBinLocal(bins: SldBin[], v: number): SldBin | undefined {
    return bins.find(b => binMatches(b, v))
}

interface DisplacementDetailDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    typeValue: ChartedType
    /** Quality + basin scoped features (all years), from the sidebar panel. */
    scoped: DisplacementFeature[]
    /** Effective threshold (in) — same knob the KPIs/stack/depth line use. */
    threshold: number
    /** SLD bins with the deadband already removed (plotBins). */
    plotBins: SldBin[]
    /** Deepest-band color for the depth line, matching the sidebar. */
    lineColor: string
    yearAxisLabel: string
}

interface DetailRow {
    year: string
    cumulativeDepth: number | null
    yearlyChange: number | null
    areaTotal: number
    [exKey: string]: string | number | null
}

export const DisplacementDetailDialog = memo(function DisplacementDetailDialog({
    open, onOpenChange, typeValue, scoped, threshold, plotBins, lineColor, yearAxisLabel,
}: DisplacementDetailDialogProps) {
    const [depthMode, setDepthMode] = useState<'cumulative' | 'change'>('cumulative')
    const [areaMode, setAreaMode] = useState<'total' | 'bydepth'>('total')
    // "Yearly change" (year-over-year diffs of the cumulative depth) only reads
    // sensibly for the running-total type; the Yearly layer is already per-year.
    const showDepthToggle = typeValue === 'Cumulative'
    const depthKey = depthMode === 'cumulative' || !showDepthToggle ? 'cumulativeDepth' : 'yearlyChange'
    // Per-type sync bus so two dialogs (different types) can't cross-sync tooltips.
    const syncId = `disp-detail-${typeValue}`

    // Up to three exceedance levels drawn from the SLD's own subsidence edges
    // (shallow / mid / deep), each colored by the map bin it sits in.
    const exceedance = useMemo(() => {
        // Only edges at/above the active threshold. The sub-threshold bands are
        // filtered out everywhere else, so offering one here would mislabel its
        // line (or, once the reviewer raises the threshold, silently undercount it).
        const edges = getBinBoundaries(plotBins).filter(e => e >= threshold) // positive magnitudes, ascending
        const picks = edges.length <= 3
            ? edges
            : [edges[0], edges[Math.floor(edges.length / 2)], edges[edges.length - 1]]
        return picks.map((level, i) => ({
            key: `ex${i}`,
            level,
            // Probe just inside the band above the edge so the swatch takes that
            // band's map color — probing the edge itself lands on a boundary/excluded bin.
            color: findBinLocal(plotBins, -(level + 0.1))?.color ?? lineColor,
            label: `≥ ${fmt1(level)} in`,
        }))
    }, [plotBins, lineColor, threshold])

    const rows = useMemo<DetailRow[]>(() => {
        const measured = scoped.filter(f => {
            const v = f.properties.value_inches
            return v < 0 && Math.abs(v) >= threshold && findBinLocal(plotBins, v) !== undefined
        })
        const areaMi2Of = (f: DisplacementFeature) => area(f) * SQM_TO_SQMI
        const depthMap = deepestSubsidenceByYear(measured)
        const areaTotalMap = subsidedAreaByYear(measured, threshold, areaMi2Of)
        const exMaps = exceedance.map(x => subsidedAreaByYear(measured, x.level, areaMi2Of))
        const years = Array.from(new Set([...depthMap.keys(), ...areaTotalMap.keys()])).sort()
        let prev: number | null = null
        return years.map(y => {
            const cum = depthMap.get(y) ?? 0
            // First year has no prior to difference against; the change series
            // starts at the second year (leaving the seed baseline out of it).
            const change = prev === null ? null : cum - prev
            prev = cum
            const row: DetailRow = { year: y, cumulativeDepth: cum, yearlyChange: change, areaTotal: areaTotalMap.get(y) ?? 0 }
            exceedance.forEach((x, i) => { row[x.key] = exMaps[i].get(y) ?? 0 })
            return row
        })
    }, [scoped, threshold, plotBins, exceedance])

    const tooltipStyle = {
        contentStyle: { fontSize: 11, background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 6, color: 'hsl(var(--popover-foreground))' },
        labelStyle: { color: 'hsl(var(--popover-foreground))' },
    }

    // Flag the Yearly seed epoch as a baseline, not a real per-year spike — same
    // treatment as the sidebar depth chart. The seed carries the multi-year
    // baseline, so it's the deepest point (max), not necessarily the first.
    const seedIndex = (typeValue === 'Yearly' && depthKey === 'cumulativeDepth' && rows.length > 0)
        ? rows.reduce((mi, r, i, arr) => ((r.cumulativeDepth ?? -Infinity) > (arr[mi].cumulativeDepth ?? -Infinity) ? i : mi), 0)
        : -1
    const renderDepthDot = (props: { cx?: number; cy?: number; index?: number; key?: string | number | bigint | null }) => {
        const { cx, cy, index, key } = props
        if (cx == null || cy == null) return <g key={key} />
        if (index === seedIndex) {
            return (
                <g key={key}>
                    <circle cx={cx} cy={cy} r={4} fill="hsl(var(--background))" stroke={lineColor} strokeWidth={2} />
                    <text x={cx + 7} y={cy + 3} fontSize={9} fill="currentColor" fillOpacity={0.7}>baseline</text>
                </g>
            )
        }
        return <circle key={key} cx={cx} cy={cy} r={2} fill={lineColor} />
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Displacement detail</DialogTitle>
                    <DialogDescription>
                        Depth and affected area over time, sharing one {yearAxisLabel.toLowerCase()} axis — hover either to line up the other. Shows all years; honors the current basin, quality, and threshold filters.
                    </DialogDescription>
                </DialogHeader>

                {rows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No measured subsidence in the current filters.</p>
                ) : (
                    <div className="flex flex-col gap-5 pt-1">
                        {/* Depth panel */}
                        <section className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Subsidence depth by {yearAxisLabel.toLowerCase()} (in)</h4>
                                {showDepthToggle && (
                                    <SegToggle
                                        value={depthMode}
                                        onChange={v => setDepthMode(v as 'cumulative' | 'change')}
                                        options={[{ value: 'cumulative', label: 'Cumulative total' }, { value: 'change', label: 'Yearly change' }]}
                                        ariaLabel="Depth series"
                                    />
                                )}
                            </div>
                            <div className="w-full [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:outline-none" style={{ height: PANEL_HEIGHT_PX }}>
                                <ResponsiveContainer width="100%" height={PANEL_HEIGHT_PX}>
                                    <LineChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                        <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                        <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                                        <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} width={52} tickFormatter={(v: number) => `${fmt1(v)} in`}>
                                            <RechartsLabel value="Subsidence (in)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                        </YAxis>
                                        <Tooltip {...tooltipStyle} formatter={(value) => [value == null ? '—' : `${fmt1(Number(value))} in`, depthKey === 'yearlyChange' ? 'This year' : 'Deepest']} />
                                        <Line type="monotone" dataKey={depthKey} stroke={lineColor} strokeWidth={2} dot={renderDepthDot} activeDot={{ r: 3 }} isAnimationActive={false} connectNulls={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            {depthKey === 'yearlyChange' && (
                                <p className="text-xs text-muted-foreground">Year-over-year change in cumulative depth (this year minus last year). The first year is blank — it carries the multi-year baseline, not a single-year change. Negative values mean a shallower cumulative reading than the year before.</p>
                            )}
                        </section>

                        {/* Area panel */}
                        <section className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium">Affected area by {yearAxisLabel.toLowerCase()} (mi²)</h4>
                                <SegToggle
                                    value={areaMode}
                                    onChange={v => setAreaMode(v as 'total' | 'bydepth')}
                                    options={[{ value: 'total', label: 'Total' }, { value: 'bydepth', label: 'By depth' }]}
                                    ariaLabel="Area series"
                                />
                            </div>
                            <div className="w-full [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:outline-none" style={{ height: PANEL_HEIGHT_PX }}>
                                <ResponsiveContainer width="100%" height={PANEL_HEIGHT_PX}>
                                    {areaMode === 'total' ? (
                                        <AreaChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                            <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                                            <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} width={52} tickFormatter={(v: number) => `${fmt1(v)}`}>
                                                <RechartsLabel value="Area (mi²)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                            </YAxis>
                                            <Tooltip {...tooltipStyle} formatter={(value) => [`${fmt1(Number(value))} mi²`, `≥ ${fmt1(threshold)} in`]} />
                                            <Area type="monotone" dataKey="areaTotal" stroke={lineColor} fill={lineColor} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                                        </AreaChart>
                                    ) : (
                                        <LineChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                            <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                                            <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} width={52} tickFormatter={(v: number) => `${fmt1(v)}`}>
                                                <RechartsLabel value="Area (mi²)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                            </YAxis>
                                            <Tooltip {...tooltipStyle} formatter={(value, name) => [`${fmt1(Number(value))} mi²`, String(name)]} />
                                            {exceedance.map(x => (
                                                <Line key={x.key} type="monotone" dataKey={x.key} name={x.label} stroke={x.color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                                            ))}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {areaMode === 'total'
                                    ? 'Total footprint sinking at/beyond the threshold.'
                                    : 'Area exceeding each depth threshold.'}
                            </p>
                            {areaMode === 'bydepth' && exceedance.length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {exceedance.map(x => (
                                        <span key={x.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: x.color }} />
                                            {x.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        <div className="flex flex-col gap-1.5 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
                            {typeValue === 'Yearly' && <p>The first year carries the multi-year baseline, not a single-year change.</p>}
                            <p>Contours are disjoint bands, so area totals are not double-counted. Blank map areas are unmeasured, not necessarily stable. InSAR measures vertical motion, not its cause.</p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
})

function SegToggle<T extends string>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel?: string }) {
    return (
        <div role="group" aria-label={ariaLabel} className="inline-flex rounded-md border border-border p-0.5">
            {options.map(o => (
                <Button
                    key={o.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn('h-6 px-2 text-xs', value === o.value ? 'bg-muted text-foreground' : 'text-muted-foreground')}
                >
                    {o.label}
                </Button>
            ))}
        </div>
    )
}
