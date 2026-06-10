import { useMemo } from 'react'
import { XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDisplacementFilters, useEffectiveYear } from './displacement-filter-context'
import {
    DISPLACEMENT_LAYER_TYPES,
    isDisplacementLayerTitle,
    isPeriodKeyedType,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementBasinsForType, useDisplacementYearsForType } from './use-displacement-queries'

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
    const { yearOverride, basinsByType, setYearOverride, addBasin, removeBasin, clearBasins } = useDisplacementFilters()

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
    const isDirty = yearOverride !== null || selectedBasins.size > 0

    function resetLocal() {
        if (yearOverride !== null) setYearOverride(null)
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

            {isDirty && (
                <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-[10px]" onClick={resetLocal}>
                    Reset all
                </Button>
            )}
        </div>
    )
}

