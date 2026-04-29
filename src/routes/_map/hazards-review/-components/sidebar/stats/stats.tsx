import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import area from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { useMap } from '@/hooks/use-map'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatsFilters } from './stats-filter-context'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const TYPE_NAME = 'hazards:hazards_displacement_contours_review'
const SQM_TO_SQMI = 1 / 2_589_988.110336
const CM_TO_FT = 0.0328084
import { DISPLACEMENT_TYPES as TYPES, type DisplacementType } from './stats-filter-context'

// CA DWR-style 8-bin warm ramp on |rate| (ft/yr); upper-exclusive
const RATE_BINS = [
    { key: '0.1–0.2', min: 0.1, max: 0.2, color: '#FFEDA0' },
    { key: '0.2–0.4', min: 0.2, max: 0.4, color: '#FED976' },
    { key: '0.4–0.6', min: 0.4, max: 0.6, color: '#FEB24C' },
    { key: '0.6–0.8', min: 0.6, max: 0.8, color: '#FD8D3C' },
    { key: '0.8–1.0', min: 0.8, max: 1.0, color: '#FC4E2A' },
    { key: '1.0–1.2', min: 1.0, max: 1.2, color: '#E31A1C' },
    { key: '1.2–1.5', min: 1.2, max: 1.5, color: '#BD0026' },
    { key: '>1.5',    min: 1.5, max: Infinity, color: '#800026' },
] as const

interface DisplacementProps {
    location: string
    type: DisplacementType
    year: string
    start_date?: string
    value_cm: number
    value_inch?: number
    huc?: string
}

type DisplacementFeature = Feature<Polygon | MultiPolygon, DisplacementProps>

async function fetchAllDisplacement(): Promise<DisplacementFeature[]> {
    const url = new URL(`${PROD_GEOSERVER_URL}/wfs`)
    url.searchParams.set('service', 'WFS')
    url.searchParams.set('version', '2.0.0')
    url.searchParams.set('request', 'GetFeature')
    url.searchParams.set('typeNames', TYPE_NAME)
    url.searchParams.set('outputFormat', 'application/json')
    url.searchParams.set('srsName', 'EPSG:4326')
    url.searchParams.set('count', '20000')
    url.searchParams.set('sortBy', 'location A')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`WFS ${res.status}`)
    const data = await res.json() as FeatureCollection<Polygon | MultiPolygon, DisplacementProps>
    return data.features
}

function uniqueSorted<T>(values: T[]): T[] {
    return Array.from(new Set(values)).sort()
}

export function Stats() {
    const { data: features = [], isLoading, isError } = useQuery({
        queryKey: ['stats', 'displacement-contours-review'],
        queryFn: fetchAllDisplacement,
        staleTime: 10 * 60 * 1000,
    })

    const { type: selectedType, year, basin, thresholdFt, setType: setSelectedType, setYear, setBasin, setThresholdFt } = useStatsFilters()
    const thresholdCm = thresholdFt / CM_TO_FT
    const { map } = useMap()

    function handleBasinChange(value: string) {
        setBasin(value)
        if (value === 'all' || !map) return
        const matches = features.filter(f => f.properties.location === value)
        if (matches.length === 0) return
        const [minX, minY, maxX, maxY] = turfBbox({ type: 'FeatureCollection', features: matches })
        map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: 12, duration: 600 })
    }

    // Cross-filtered facets: each dropdown's options reflect the OTHER filters but exclude its own.
    const years = useMemo(() => {
        const matches = features.filter(f => {
            if (f.properties.type !== selectedType) return false
            if (basin !== 'all' && f.properties.location !== basin) return false
            return true
        })
        return uniqueSorted(matches.map(f => f.properties.year))
    }, [features, selectedType, basin])

    const basins = useMemo(() => {
        const matches = features.filter(f => {
            if (f.properties.type !== selectedType) return false
            if (year !== 'all' && f.properties.year !== year) return false
            return true
        })
        return uniqueSorted(matches.map(f => f.properties.location))
    }, [features, selectedType, year])

    // Clamp stale selections against facet availability without storing the clamp.
    const effectiveYear = year === 'all' || years.includes(year) ? year : 'all'
    const effectiveBasin = basin === 'all' || basins.includes(basin) ? basin : 'all'

    const filtered = useMemo(() => {
        return features.filter(f => {
            const p = f.properties
            if (p.type !== selectedType) return false
            if (effectiveYear !== 'all' && p.year !== effectiveYear) return false
            if (effectiveBasin !== 'all' && p.location !== effectiveBasin) return false
            return true
        })
    }, [features, selectedType, effectiveYear, effectiveBasin])

    const overThreshold = useMemo(
        () => filtered.filter(f => Math.abs(f.properties.value_cm) >= thresholdCm),
        [filtered, thresholdCm]
    )

    const totalAreaSqMi = useMemo(
        () => overThreshold.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [overThreshold]
    )

    const maxDisplacement = useMemo(() => {
        let max = 0
        for (const f of filtered) {
            const v = Math.abs(f.properties.value_cm)
            if (v > max) max = v
        }
        return max
    }, [filtered])

    const distinctBasins = useMemo(() => new Set(filtered.map(f => f.properties.location)).size, [filtered])

    const period = useMemo(() => {
        if (filtered.length === 0) return null
        const yrs = filtered.map(f => f.properties.year).filter(Boolean)
        return { from: yrs.reduce((a, b) => a < b ? a : b), to: yrs.reduce((a, b) => a > b ? a : b) }
    }, [filtered])

    // Stacked bar: sq mi per year × rate-bin. Ignores year filter so users see full timeseries.
    // Threshold filters out features below the floor and clips bins entirely below it.
    const visibleBins = useMemo(() => RATE_BINS.filter(b => b.max > thresholdFt), [thresholdFt])
    const stackedAreaByYear = useMemo(() => {
        const yearToBins = new Map<string, Record<string, number>>()
        for (const f of features) {
            if (f.properties.type !== selectedType) continue
            if (effectiveBasin !== 'all' && f.properties.location !== effectiveBasin) continue
            const ft = Math.abs(f.properties.value_cm) * CM_TO_FT
            if (ft < thresholdFt) continue
            const bin = visibleBins.find(b => ft >= b.min && ft < b.max)
            if (!bin) continue
            const y = f.properties.year
            if (!yearToBins.has(y)) yearToBins.set(y, {})
            const a = area(f) * SQM_TO_SQMI
            const buckets = yearToBins.get(y)!
            buckets[bin.key] = (buckets[bin.key] ?? 0) + a
        }
        return Array.from(yearToBins, ([year, bins]) => ({ year, ...bins }))
            .sort((a, b) => a.year.localeCompare(b.year))
    }, [features, selectedType, effectiveBasin, thresholdFt, visibleBins])

    const topBasins = useMemo(() => {
        const grouped = new Map<string, number>()
        for (const f of filtered) {
            const v = Math.abs(f.properties.value_cm)
            const cur = grouped.get(f.properties.location) ?? 0
            if (v > cur) grouped.set(f.properties.location, v)
        }
        return Array.from(grouped, ([loc, max]) => ({ location: loc, max: Number((max * CM_TO_FT).toFixed(3)) }))
            .filter(b => b.max >= thresholdFt)
            .sort((a, b) => b.max - a.max)
            .slice(0, 10)
    }, [filtered, thresholdFt])

    if (isError) return <div className="p-4 text-sm text-destructive">Failed to load displacement data.</div>

    return (
        <div className="flex flex-col gap-4 p-2 max-h-[calc(100vh-100px)] overflow-y-auto">
            <BackToMenuButton />
            <h2 className="text-lg font-semibold px-2">Land Subsidence Stats</h2>

            <div className="grid grid-cols-2 gap-3 px-2">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Type</Label>
                    <Select disabled={isLoading} value={selectedType} onValueChange={(v) => setSelectedType(v as DisplacementType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Water Year</Label>
                    <Select disabled={isLoading} value={effectiveYear} onValueChange={setYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All years</SelectItem>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Basin</Label>
                    <Select disabled={isLoading} value={effectiveBasin} onValueChange={handleBasinChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All basins</SelectItem>
                            {basins.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs">Threshold (|ft/yr|)</Label>
                    <Input
                        type="number"
                        step="0.05"
                        min="0"
                        disabled={isLoading}
                        value={thresholdFt}
                        onChange={(e) => setThresholdFt(Number(e.target.value) || 0)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-2">
                <KPI label="Subsiding Area" value={isLoading ? '—' : `${totalAreaSqMi.toFixed(1)} mi²`} sub={`|rate| ≥ ${thresholdFt} ft/yr`} />
                <KPI label="Max Rate" value={isLoading ? '—' : `${(maxDisplacement * CM_TO_FT).toFixed(2)} ft/yr`} sub={selectedType} />
                <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
                <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
            </div>

            <div className="px-2 text-foreground">
                <h3 className="text-sm font-medium mb-2">Subsiding Area by Year ({selectedType})</h3>
                <p className="text-xs text-muted-foreground mb-2">Stacked by rate category (ft/yr). Year filter does not apply.</p>
                <div className="h-72 w-full">
                    {isLoading ? <Skeleton className="h-full w-full" /> : (
                    <ResponsiveContainer>
                        <BarChart data={stackedAreaByYear}>
                            <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                            <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} />
                            <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} unit=" mi²" width={55} />
                            <Tooltip
                                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                            />
                            {visibleBins.map(bin => (
                                <Bar key={bin.key} dataKey={bin.key} stackId="rate" fill={bin.color} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground">
                    {visibleBins.map(bin => (
                        <div key={bin.key} className="flex items-center gap-1.5">
                            <span
                                className="inline-block h-3 w-3 rounded-sm border border-border"
                                style={{ background: bin.color }}
                                aria-hidden
                            />
                            <span>{bin.key} ft/yr</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-2 text-foreground">
                <h3 className="text-sm font-medium mb-2">Top Basins by Max Rate</h3>
                {isLoading ? <Skeleton className="h-72 w-full" /> : topBasins.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No basins meet the current filter.</p>
                ) : (
                    <div className="space-y-1.5">
                        {topBasins.map(b => {
                            const top = topBasins[0].max
                            const pct = top > 0 ? (b.max / top) * 100 : 0
                            const bin = RATE_BINS.find(r => b.max >= r.min && b.max < r.max)
                            const color = bin?.color ?? 'hsl(var(--primary))'
                            return (
                                <div key={b.location} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                                    <span className="truncate" title={b.location}>{b.location}</span>
                                    <div className="h-3 bg-muted overflow-hidden border border-border">
                                        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                    <span className="text-right tabular-nums text-muted-foreground">{b.max} ft/yr</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card>
            <CardHeader className="p-3 pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-xl font-semibold">{value}</div>
                {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
            </CardContent>
        </Card>
    )
}
