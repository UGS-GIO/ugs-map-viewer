import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDisplacementFilters, useEffectiveThresholdsIn, isChartedType } from './displacement-filter-context'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle, type DisplacementType } from './displacement-layers'
import { DISPLACEMENT_QUERY_KEY, fetchAllDisplacement, getBucketYear } from './displacement-layer-charts'

// Cumulative + Vertical Displacement Rate carry null `year` so the year filter
// can't apply — only Yearly exposes a Water Year selector.
const TYPES_WITH_YEAR: ReadonlySet<DisplacementType> = new Set(['Yearly'])

export function renderDisplacementLayerFilters(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[layerTitle]
    return <DisplacementLayerFilters typeValue={typeValue} />
}

function DisplacementLayerFilters({ typeValue }: { typeValue: DisplacementType }) {
    const { year, thresholdsIn, basinsByType, setYear, setThresholdIn, addBasin, removeBasin, clearBasins } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()

    const hasYear = TYPES_WITH_YEAR.has(typeValue)
    const isCharted = isChartedType(typeValue)

    const { data: features = [] } = useQuery({
        queryKey: DISPLACEMENT_QUERY_KEY,
        queryFn: fetchAllDisplacement,
        staleTime: 10 * 60 * 1000,
    })

    const years = useMemo(() => {
        if (!hasYear) return []
        const ys = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== typeValue) continue
            const y = getBucketYear(f.properties)
            if (y) ys.add(y)
        }
        return Array.from(ys).sort()
    }, [features, typeValue, hasYear])

    // All basins present for this type. Drives the "add basin" dropdown so it
    // only offers locations that actually have features.
    const allBasins = useMemo(() => {
        const set = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== typeValue) continue
            if (f.properties.location) set.add(f.properties.location)
        }
        return Array.from(set).sort()
    }, [features, typeValue])

    const selectedBasins = basinsByType[typeValue]
    const availableBasins = useMemo(
        () => allBasins.filter(b => !selectedBasins.has(b)),
        [allBasins, selectedBasins],
    )

    const displayYear = year === 'all' || years.includes(year) ? year : 'all'
    const thresholdIn = isCharted ? effective[typeValue] : 0
    const rawThreshold = isCharted ? thresholdsIn[typeValue] : null
    const isDirty = (hasYear && year !== 'all') || rawThreshold !== null || selectedBasins.size > 0

    function resetLocal() {
        if (hasYear) setYear('all')
        if (isCharted) setThresholdIn(typeValue, null)
        if (selectedBasins.size > 0) clearBasins(typeValue)
    }

    return (
        <div className="flex flex-col gap-2">
            {hasYear && (
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Water Year</Label>
                    <Select value={displayYear} onValueChange={setYear}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {isCharted && (
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">
                        Threshold (|in|)
                        {rawThreshold === null && (
                            <span className="ml-1 text-muted-foreground">· auto (SLD)</span>
                        )}
                    </Label>
                    <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="h-8"
                        value={thresholdIn}
                        onChange={(e) => setThresholdIn(typeValue, Number(e.target.value) || 0)}
                    />
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
