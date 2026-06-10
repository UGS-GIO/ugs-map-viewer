import { useMemo } from 'react'
import { MinusIcon, PlusIcon, XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
import { useDisplacementBasinsForType, useDisplacementSldBins, useDisplacementYearsForType } from './use-displacement-queries'
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
    const { yearOverride, thresholdsIn, basinsByType, setYearOverride, setThreshold, addBasin, removeBasin, clearBasins } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()

    const isCharted = isChartedType(typeValue)

    // Year options + basin options both derived inside TanStack `select` so the
    // raw 20k-feature array doesn't reach this component. hasYear flips on once
    // any years exist for this type so the dropdown stays hidden if nothing to
    // pick.
    const years = useDisplacementYearsForType(typeValue)
    const hasYear = years.length > 0
    const allBasins = useDisplacementBasinsForType(typeValue)
    const effectiveYear = useEffectiveYear(typeValue)

    const selectedBasins = basinsByType[typeValue]
    const availableBasins = useMemo(
        () => allBasins.filter(b => !selectedBasins.has(b)),
        [allBasins, selectedBasins],
    )

    // Year dropdown always reflects the effective year (override or latest).
    // Empty string is a transient state only while features are still loading.
    const displayYear = effectiveYear && years.includes(effectiveYear) ? effectiveYear : (years[years.length - 1] ?? '')
    const thresholdIn = isCharted ? effective[typeValue] : 0
    const rawThreshold = isCharted ? thresholdsIn[typeValue] : null
    const isDirty = yearOverride !== null || rawThreshold !== null || selectedBasins.size > 0

    function resetLocal() {
        if (yearOverride !== null) setYearOverride(null)
        if (isCharted) setThreshold(typeValue, null)
        if (selectedBasins.size > 0) clearBasins(typeValue)
    }

    return (
        <div className="flex flex-col gap-2">
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
                        <p className="text-[10px] text-muted-foreground">Defaults to latest. Pick a year above.</p>
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
                            className="h-6 px-2 text-[10px]"
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
                                className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground hover:bg-muted/70"
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

            {isCharted && (
                <ThresholdStepper
                    typeValue={typeValue}
                    currentThresholdIn={thresholdIn}
                    isCustom={rawThreshold !== null}
                    onChange={(n) => setThreshold(typeValue, n)}
                    onReset={() => setThreshold(typeValue, null)}
                />
            )}

            {isDirty && (
                <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-[10px]" onClick={resetLocal}>
                    Reset all
                </Button>
            )}
        </div>
    )
}

// Pull the positive bin edges out of the SLD response, deduped + sorted. Any
// |value_inch| between two adjacent edges yields the same filtered set, so
// stepping by edge is the smallest move that actually changes what's shown.
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

function findNextBoundary(boundaries: number[], current: number, direction: 1 | -1): number | null {
    const epsilon = 1e-6
    if (direction === 1) return boundaries.find(b => b > current + epsilon) ?? null
    for (let i = boundaries.length - 1; i >= 0; i--) {
        if (boundaries[i] < current - epsilon) return boundaries[i]
    }
    return null
}

interface ThresholdStepperProps {
    typeValue: ChartedType
    currentThresholdIn: number
    isCustom: boolean
    onChange: (n: number) => void
    onReset: () => void
}

// One honest threshold stepper. Snaps to SLD bin edges (the smallest steps that
// actually re-filter), and is explicit that it affects the map, chart, and
// stats — not a "visualization only" knob.
function ThresholdStepper({ typeValue, currentThresholdIn, isCustom, onChange, onReset }: ThresholdStepperProps) {
    const styleName = getStyleNameForType(typeValue) ?? ''
    const { data: sldBins = [] } = useDisplacementSldBins(styleName)
    const boundaries = useMemo(() => getBinBoundaries(sldBins), [sldBins])

    const fmt = (n: number) => n.toFixed(1)
    const prevBoundary = findNextBoundary(boundaries, currentThresholdIn, -1)
    const nextBoundary = findNextBoundary(boundaries, currentThresholdIn, 1)

    return (
        <div className="flex flex-col gap-1 rounded border border-dashed border-border p-2">
            <Label className="text-xs">
                Threshold (|in|)
                {!isCustom && <span className="ml-1 text-muted-foreground">· SLD default</span>}
            </Label>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => prevBoundary !== null && onChange(prevBoundary)}
                    disabled={prevBoundary === null}
                    title={prevBoundary !== null ? `Step down to ${fmt(prevBoundary)} in` : 'No smaller bin edge'}
                    aria-label="Step threshold down to previous SLD bin edge"
                >
                    <MinusIcon className="h-3.5 w-3.5" />
                </Button>
                <div className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-center text-sm tabular-nums">
                    {fmt(currentThresholdIn)} in
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => nextBoundary !== null && onChange(nextBoundary)}
                    disabled={nextBoundary === null}
                    title={nextBoundary !== null ? `Step up to ${fmt(nextBoundary)} in` : 'No larger bin edge'}
                    aria-label="Step threshold up to next SLD bin edge"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
                Hides features with |value| below this. Applies to the map, chart, and stats. Steps snap to SLD bin edges.
            </p>
            {isCustom && (
                <Button variant="ghost" size="sm" className="h-6 self-start px-2 text-[10px]" onClick={onReset}>
                    Reset to default
                </Button>
            )}
        </div>
    )
}

