import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Label } from 'recharts'
import type { LayerContentProps, ExtendedFeature } from '@/components/maps/popups/types'
import { isDisplacementLayerTitle, DISPLACEMENT_LAYER_TYPES, type DisplacementType } from './displacement-layers'
import { CHARTED_TYPES, type ChartedType } from './displacement-filter-context'
import { DISPLACEMENT_QUERY_KEY, fetchAllDisplacement, getBucketYear } from './displacement-layer-charts'

const fmt1 = (n: number): string => n.toFixed(1)

function isChartedType(t: DisplacementType): t is ChartedType {
    return (CHARTED_TYPES as readonly string[]).includes(t)
}

export function renderDisplacementFeatureChart(feature: ExtendedFeature, layer: LayerContentProps): React.ReactNode {
    const title = layer.layerTitle || layer.groupLayerTitle || ''
    if (!isDisplacementLayerTitle(title)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[title]
    // Per-feature timeseries needs a per-year cadence — skip types without one.
    if (!isChartedType(typeValue)) return null
    const props = feature.properties as { location?: string; year?: string | null; end_date?: string | null } | undefined
    const location = props?.location
    if (!location) return null
    const currentBucketYear = getBucketYear({
        type: typeValue,
        year: props?.year ?? null,
        end_date: props?.end_date ?? null,
    })
    return (
        <DisplacementFeatureChart
            location={location}
            typeValue={typeValue}
            currentYear={currentBucketYear ?? undefined}
        />
    )
}

function DisplacementFeatureChart({
    location,
    typeValue,
    currentYear,
}: {
    location: string
    typeValue: string
    currentYear?: string
}) {
    const { data: features = [], isLoading, isError } = useQuery({
        queryKey: DISPLACEMENT_QUERY_KEY,
        queryFn: fetchAllDisplacement,
        staleTime: 10 * 60 * 1000,
    })

    const series = useMemo(() => {
        const matches = features.filter(f =>
            f.properties.type === typeValue && f.properties.location === location
        )
        // Pick max |value| per bucket year so duplicates don't double-plot.
        // Cumulative buckets by period end year; Yearly by water year.
        const byYear = new Map<string, number>()
        for (const f of matches) {
            const bucketYear = getBucketYear(f.properties)
            if (!bucketYear) continue
            const v = Math.abs(f.properties.value_inch)
            const cur = byYear.get(bucketYear) ?? 0
            if (v > cur) byYear.set(bucketYear, v)
        }
        return Array.from(byYear, ([year, value]) => ({ year, value: Number(fmt1(value)) }))
            .sort((a, b) => a.year.localeCompare(b.year))
    }, [features, location, typeValue])

    if (isError || (!isLoading && series.length < 2)) return null

    return (
        <div className="mt-2 pt-2 border-t border-border">
            <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                {location} · {typeValue} timeseries
            </h4>
            <div className="h-36 w-full">
                {isLoading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer>
                        <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                            <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                            <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} unit=" in" width={70} tickMargin={4}>
                                <Label value="|displacement| (in)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip
                                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                                formatter={(v) => [`${typeof v === 'number' ? fmt1(v) : v} in`, '|displacement|']}
                            />
                            <Bar dataKey="value">
                                {series.map(d => (
                                    <Cell key={d.year} fill={d.year === currentYear ? '#BD0026' : '#FEB24C'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
