import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
    const hasYear = TYPES_WITH_YEAR.has(typeValue)
    const hasThreshold = isChartedType(typeValue)
    if (!hasYear && !hasThreshold) return null
    return <DisplacementLayerFilters typeValue={typeValue} hasYear={hasYear} hasThreshold={hasThreshold} />
}

function DisplacementLayerFilters({
    typeValue,
    hasYear,
    hasThreshold,
}: {
    typeValue: DisplacementType
    hasYear: boolean
    hasThreshold: boolean
}) {
    const { year, thresholdsIn, setYear, setThresholdIn } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()

    const { data: features = [] } = useQuery({
        queryKey: DISPLACEMENT_QUERY_KEY,
        queryFn: fetchAllDisplacement,
        staleTime: 10 * 60 * 1000,
        enabled: hasYear,
    })

    const years = useMemo(() => {
        const ys = new Set<string>()
        for (const f of features) {
            if (f.properties.type !== typeValue) continue
            const y = getBucketYear(f.properties)
            if (y) ys.add(y)
        }
        return Array.from(ys).sort()
    }, [features, typeValue])

    const displayYear = year === 'all' || years.includes(year) ? year : 'all'
    const isCharted = hasThreshold && isChartedType(typeValue)
    // Display the effective threshold (state value OR SLD-derived default) so
    // reviewers always see the number actually filtering the map.
    const thresholdIn = isCharted ? effective[typeValue] : 0
    // "Dirty" means the user explicitly overrode the SLD-derived default — i.e.
    // raw state is non-null. Reset wipes back to null so SLD default takes over.
    const rawThreshold = isCharted ? thresholdsIn[typeValue] : null
    const isDirty = (hasYear && year !== 'all') || rawThreshold !== null

    function resetLocal() {
        if (hasYear) setYear('all')
        if (isCharted) setThresholdIn(typeValue, null)
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

            {isDirty && (
                <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-[10px]" onClick={resetLocal}>
                    Reset
                </Button>
            )}
        </div>
    )
}
