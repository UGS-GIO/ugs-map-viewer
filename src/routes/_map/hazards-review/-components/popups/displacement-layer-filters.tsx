import { useMemo, useState, useId } from 'react'
import { XIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useDisplacementFilters, useEffectiveThresholdsIn, useEffectiveYear } from './displacement-filter-context'
import {
    DATA_QUAL_DESCRIPTIONS,
    DEFAULT_EXCLUDED_DATA_QUALS,
    DISPLACEMENT_LAYER_TYPES,
    getStyleNameForType,
    isChartedType,
    isDisplacementLayerTitle,
    type ChartedType,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementBasinsForType, useDisplacementBasinYearIndexForType, useDisplacementDataQualsForType, useDisplacementSldBins, useDisplacementValueMagnitudesForType, useDisplacementYearsForType } from './use-displacement-queries'
import { getPopulatedBinBoundaries } from './displacement-thresholds'

// Compare a live exclusion set against the high/medium default so "dirty" means
// "the reviewer changed data-quality from the default", not "anything excluded".
function isDefaultDataQuals(excluded: ReadonlySet<string>): boolean {
    return excluded.size === DEFAULT_EXCLUDED_DATA_QUALS.length
        && DEFAULT_EXCLUDED_DATA_QUALS.every(q => excluded.has(q))
}

// Label the year dropdown by type semantics: 'Water Year' for Yearly,
// 'Period End Year' for Cumulative + Vertical Displacement Rate.
function yearLabelFor(type: DisplacementType): string {
    return type === 'Yearly' ? 'Water Year' : 'Period End Year'
}

export function renderDisplacementLayerFilters(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[layerTitle]
    return <DisplacementLayerFilters typeValue={typeValue} />
}

function DisplacementLayerFilters({ typeValue }: { typeValue: DisplacementType }) {
    const { yearOverridesByType, thresholdsIn, basinsByType, excludedDataQualsByType, setYearOverride, setThreshold, addBasin, removeBasin, clearBasins, toggleDataQual, clearDataQuals } = useDisplacementFilters()
    const yearOverride = yearOverridesByType[typeValue]
    const effective = useEffectiveThresholdsIn()

    const isCharted = isChartedType(typeValue)

    // Year options + basin options both derived inside TanStack `select` so the
    // raw 20k-feature array doesn't reach this component. hasYear flips on once
    // any years exist for this type so the dropdown stays hidden if nothing to
    // pick.
    const years = useDisplacementYearsForType(typeValue)
    const hasYear = years.length > 0
    const allBasins = useDisplacementBasinsForType(typeValue)
    const dataQuals = useDisplacementDataQualsForType(typeValue)
    const effectiveYear = useEffectiveYear(typeValue)
    const { yearsByBasin, basinsByYear } = useDisplacementBasinYearIndexForType(typeValue)

    const selectedBasins = basinsByType[typeValue]
    const availableBasins = useMemo(
        () => allBasins.filter(b => !selectedBasins.has(b)),
        [allBasins, selectedBasins],
    )
    const excludedQuals = excludedDataQualsByType[typeValue]
    const dataQualsDirty = !isDefaultDataQuals(excludedQuals)

    // Year dropdown always reflects the effective year (override or latest).
    // Empty string is a transient state only while features are still loading.
    const displayYear = effectiveYear && years.includes(effectiveYear) ? effectiveYear : (years[years.length - 1] ?? '')
    const thresholdIn = isCharted ? effective[typeValue] : 0

    // Mutual graying between the basin and year pickers: once basins are
    // selected, years with no data for ANY selected basin grey out (union, not
    // intersection — reviewing basin A's 2019 data and basin B's 2021 data in
    // the same session is normal). Once a year is in effect, basins with no
    // data for that year grey out in the "add a basin" list. Both are visual
    // hints only — grayed options stay selectable, nothing is hidden.
    const yearsWithDataForSelectedBasins = useMemo(() => {
        if (selectedBasins.size === 0) return null
        const union = new Set<string>()
        for (const b of selectedBasins) {
            for (const y of yearsByBasin[b] ?? []) union.add(y)
        }
        return union
    }, [selectedBasins, yearsByBasin])
    const basinsWithDataForEffectiveYear = hasYear ? (basinsByYear[displayYear] ?? new Set<string>()) : null
    const rawThreshold = isCharted ? thresholdsIn[typeValue] : null
    const isDirty = yearOverride !== null || rawThreshold !== null || selectedBasins.size > 0 || dataQualsDirty

    // Data quality + threshold are power-user controls — tuck them under a
    // collapsed "Refine" disclosure so basin + year lead. A "· modified" hint
    // keeps active refinements visible while collapsed. Matches the button +
    // chevron disclosure used elsewhere (CollapsibleSection, popup-content-display).
    const [refineOpen, setRefineOpen] = useState(false)
    const refineId = useId()
    const refineDirty = dataQualsDirty || (isCharted && rawThreshold !== null)

    function resetLocal() {
        if (yearOverride !== null) setYearOverride(typeValue, null)
        if (isCharted) setThreshold(typeValue, null)
        if (selectedBasins.size > 0) clearBasins(typeValue)
        if (dataQualsDirty) clearDataQuals(typeValue)
    }

    return (
        <div className="flex flex-col gap-2 px-2 py-1">
            {isDirty && (
                <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-xs" onClick={resetLocal}>
                    Reset all
                </Button>
            )}

            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <Label className="text-xs">
                        Basins
                        {selectedBasins.size > 0 && (
                            <span className="ml-1 text-muted-foreground">· {selectedBasins.size} selected</span>
                        )}
                    </Label>
                    {selectedBasins.size > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => clearBasins(typeValue)}
                        >
                            Reset Basins
                        </Button>
                    )}
                </div>
                {selectedBasins.size > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {Array.from(selectedBasins).sort().map(loc => (
                            <button
                                key={loc}
                                type="button"
                                onClick={() => removeBasin(typeValue, loc)}
                                className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-muted/70"
                            >
                                <span className="max-w-[12rem] truncate">{loc}</span>
                                <XIcon className="h-3 w-3" />
                            </button>
                        ))}
                    </div>
                )}
                <Select
                    value=""
                    onValueChange={(loc) => loc && addBasin(typeValue, loc)}
                    disabled={availableBasins.length === 0}
                >
                    <SelectTrigger className="h-8">
                        <SelectValue placeholder={availableBasins.length === 0 ? 'All basins selected' : 'Add a basin…'} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableBasins.map(b => (
                            <SelectItem
                                key={b}
                                value={b}
                                className={cn(basinsWithDataForEffectiveYear !== null && !basinsWithDataForEffectiveYear.has(b) && 'text-muted-foreground opacity-50')}
                            >
                                {b}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {basinsWithDataForEffectiveYear !== null && availableBasins.some(b => !basinsWithDataForEffectiveYear.has(b)) && (
                    <p className="text-xs text-muted-foreground">Greyed-out basins have no data for {displayYear}.</p>
                )}
            </div>

            {hasYear && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{yearLabelFor(typeValue)}</Label>
                        {yearOverride !== null && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setYearOverride(typeValue, null)}
                            >
                                Reset {yearLabelFor(typeValue)}
                            </Button>
                        )}
                    </div>
                    <Select value={displayYear} onValueChange={(y) => setYearOverride(typeValue, y)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => (
                                <SelectItem
                                    key={y}
                                    value={y}
                                    className={cn(yearsWithDataForSelectedBasins !== null && !yearsWithDataForSelectedBasins.has(y) && 'text-muted-foreground opacity-50')}
                                >
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {yearOverride === null && (
                        <p className="text-xs text-muted-foreground">Defaults to latest. Pick a year above.</p>
                    )}
                    {yearsWithDataForSelectedBasins !== null && years.some(y => !yearsWithDataForSelectedBasins.has(y)) && (
                        <p className="text-xs text-muted-foreground">Greyed-out years have no data for the selected basin(s).</p>
                    )}
                </div>
            )}

            {(dataQuals.length > 0 || isCharted) && (
                <div className="flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={() => setRefineOpen(o => !o)}
                        aria-expanded={refineOpen}
                        aria-controls={refineId}
                        className="flex items-center gap-1 self-start rounded px-1 -ml-1 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {refineOpen
                            ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                        <span>Refine · data quality{isCharted ? ', threshold' : ''}</span>
                        {refineDirty && <span className="ml-1 font-medium text-foreground">· modified</span>}
                    </button>
                    {refineOpen && (
                        <div id={refineId} className="flex flex-col gap-2">
                            {dataQuals.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">
                                            Data quality
                                            {dataQuals.some(q => excludedQuals.has(q)) && (
                                                <span className="ml-1 text-muted-foreground">· {dataQuals.filter(q => !excludedQuals.has(q)).length}/{dataQuals.length}</span>
                                            )}
                                        </Label>
                                        {dataQualsDirty && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={() => clearDataQuals(typeValue)}
                                            >
                                                Reset
                                            </Button>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {dataQuals.map(q => {
                                            const checked = !excludedQuals.has(q)
                                            return (
                                                <label key={q} className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => toggleDataQual(typeValue, q)}
                                                        aria-label={`Toggle ${q} data quality`}
                                                        className="mt-0.5"
                                                    />
                                                    <span className="flex flex-col leading-tight">
                                                        <span className="capitalize">{q}</span>
                                                        {DATA_QUAL_DESCRIPTIONS[q] && (
                                                            <span className="text-[10px] text-muted-foreground">{DATA_QUAL_DESCRIPTIONS[q]}</span>
                                                        )}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {isCharted && (
                                <ThresholdSelect
                                    typeValue={typeValue}
                                    currentThresholdIn={thresholdIn}
                                    onChange={(n) => setThreshold(typeValue, n)}
                                    onReset={() => setThreshold(typeValue, null)}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

interface ThresholdSelectProps {
    typeValue: ChartedType
    currentThresholdIn: number
    onChange: (n: number) => void
    onReset: () => void
}

// Threshold as a dropdown of the SLD bin edges the data actually fills (see
// getPopulatedBinBoundaries — empty-band edges are dropped so no two options
// filter to the same set). The first, smallest offered edge is the per-type
// default (marked "· default") and is exactly what the effective threshold
// resolves to when unset, so the map, chart, and dropdown all agree. Picking it
// resets to that default; larger edges tighten the filter on |value| (both
// signs). Below the default isn't offered — that band is the measurement-noise
// deadband, which the chart and (at the default) the map both exclude.
function ThresholdSelect({ typeValue, currentThresholdIn, onChange, onReset }: ThresholdSelectProps) {
    const styleName = getStyleNameForType(typeValue) ?? ''
    const { data: sldBins = [] } = useDisplacementSldBins(styleName)
    const magnitudes = useDisplacementValueMagnitudesForType(typeValue)
    const boundaries = useMemo(() => getPopulatedBinBoundaries(sldBins, magnitudes), [sldBins, magnitudes])
    if (boundaries.length === 0) return null

    const fmt = (n: number) => n.toFixed(1)
    const defaultThreshold = boundaries[0]
    // currentThresholdIn (the effective threshold) defaults to this same floor,
    // so normally it equals defaultThreshold. Clamp up only so a stale sub-floor
    // override (e.g. an old URL) can't render blank against options that start at
    // the floor.
    const selected = fmt(Math.max(currentThresholdIn, defaultThreshold))

    return (
        <div className="flex flex-col gap-1 rounded border border-dashed border-border p-2">
            <Label className="text-xs">Threshold (|in|)</Label>
            <Select
                value={selected}
                onValueChange={(v) => {
                    const n = parseFloat(v)
                    if (Math.abs(n - defaultThreshold) < 1e-6) onReset()
                    else onChange(n)
                }}
            >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {boundaries.map(b => (
                        <SelectItem key={b} value={fmt(b)}>
                            {fmt(b)} in{Math.abs(b - defaultThreshold) < 1e-6 ? ' · default' : ''}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                Hides features with |value| below this (keeps both subsidence and uplift). Applies to the map, chart, and stats.
            </p>
        </div>
    )
}

