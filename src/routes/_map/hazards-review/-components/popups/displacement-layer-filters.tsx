import { useMemo } from 'react'
import { XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useDisplacementFilters, useEffectiveThresholdsIn, useEffectiveYear } from './displacement-filter-context'
import {
    DISPLACEMENT_LAYER_TYPES,
    getStyleNameForType,
    isChartedType,
    isDisplacementLayerTitle,
    isPeriodKeyedType,
    type ChartedType,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementBasinsForType, useDisplacementDataQualsForType, useDisplacementSldBins, useDisplacementYearsForType } from './use-displacement-queries'
import { type SldBin } from './displacement-sld-legend'

// Label the year dropdown by type semantics: 'Water Year' for Yearly,
// 'Period End Year' for Cumulative + Vertical Displacement Rate.
function yearLabelFor(type: DisplacementType): string {
    return isPeriodKeyedType(type) ? 'Period End Year' : 'Water Year'
}

export function renderDisplacementLayerFilters(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[layerTitle]
    return <DisplacementLayerFilters typeValue={typeValue} />
}

function DisplacementLayerFilters({ typeValue }: { typeValue: DisplacementType }) {
    const { yearOverride, thresholdsIn, basinsByType, excludedDataQualsByType, setYearOverride, setThreshold, addBasin, removeBasin, clearBasins, toggleDataQual, clearDataQuals } = useDisplacementFilters()
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

    const selectedBasins = basinsByType[typeValue]
    const availableBasins = useMemo(
        () => allBasins.filter(b => !selectedBasins.has(b)),
        [allBasins, selectedBasins],
    )
    const excludedQuals = excludedDataQualsByType[typeValue]

    // Year dropdown always reflects the effective year (override or latest).
    // Empty string is a transient state only while features are still loading.
    const displayYear = effectiveYear && years.includes(effectiveYear) ? effectiveYear : (years[years.length - 1] ?? '')
    const thresholdIn = isCharted ? effective[typeValue] : 0
    const rawThreshold = isCharted ? thresholdsIn[typeValue] : null
    const isDirty = yearOverride !== null || rawThreshold !== null || selectedBasins.size > 0 || excludedQuals.size > 0

    function resetLocal() {
        if (yearOverride !== null) setYearOverride(null)
        if (isCharted) setThreshold(typeValue, null)
        if (selectedBasins.size > 0) clearBasins(typeValue)
        if (excludedQuals.size > 0) clearDataQuals(typeValue)
    }

    return (
        <div className="flex flex-col gap-2 px-2 py-1">
            {hasYear && (
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">{yearLabelFor(typeValue)}</Label>
                    <Select value={displayYear} onValueChange={setYearOverride}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {yearOverride === null && (
                        <p className="text-xs text-muted-foreground">Defaults to latest. Pick a year above.</p>
                    )}
                </div>
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
                            Clear
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
                        {availableBasins.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {dataQuals.length > 0 && (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">
                            Data quality
                            {excludedQuals.size > 0 && (
                                <span className="ml-1 text-muted-foreground">· {dataQuals.length - excludedQuals.size}/{dataQuals.length}</span>
                            )}
                        </Label>
                        {excludedQuals.size > 0 && (
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
                                <label key={q} className="flex items-center gap-2 text-xs text-foreground capitalize cursor-pointer">
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => toggleDataQual(typeValue, q)}
                                        aria-label={`Toggle ${q} data quality`}
                                    />
                                    <span>{q}</span>
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

            {isDirty && (
                <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-xs" onClick={resetLocal}>
                    Reset all
                </Button>
            )}
        </div>
    )
}

// Positive bin edges from the SLD response, deduped + sorted ascending. These
// are the only meaningful threshold values (any |value_inch| between two edges
// yields the same filtered set). The smallest edge is the SLD's "Zero" deadband
// bound (1.2 in), so every option is >= 1.2 by construction — the UI can't drop
// the threshold below the uncertainty band.
function getBinBoundaries(bins: SldBin[]): number[] {
    const edges = new Set<number>()
    for (const b of bins) {
        if (b.isZero) continue
        for (const v of [b.min, b.max]) {
            if (Number.isFinite(v)) edges.add(Math.abs(v))
        }
    }
    return Array.from(edges).filter(v => v > 0).sort((a, b) => a - b)
}

interface ThresholdSelectProps {
    typeValue: ChartedType
    currentThresholdIn: number
    onChange: (n: number) => void
    onReset: () => void
}

// Threshold as a predefined dropdown of SLD bin edges. The first option is the
// SLD default (the Zero-deadband bound, ~1.2 in); selecting it resets to default.
// Selecting a larger edge tightens the filter on |value| (both signs) across the
// map, chart, and stats. Below-default values aren't offered — the deadband is
// measurement noise, so reviewers can only raise the bar, not lower it.
function ThresholdSelect({ typeValue, currentThresholdIn, onChange, onReset }: ThresholdSelectProps) {
    const styleName = getStyleNameForType(typeValue) ?? ''
    const { data: sldBins = [] } = useDisplacementSldBins(styleName)
    const boundaries = useMemo(() => getBinBoundaries(sldBins), [sldBins])
    if (boundaries.length === 0) return null

    const fmt = (n: number) => n.toFixed(1)
    const defaultThreshold = boundaries[0]
    const selected = fmt(currentThresholdIn)

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

