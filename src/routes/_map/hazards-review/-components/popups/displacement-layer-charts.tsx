import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import area from '@turf/area'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Label as RechartsLabel } from 'recharts'
import type { LayerContentProps } from '@/components/maps/popups/types'
import { useDisplacementFilters, useEffectiveThresholdsIn, isChartedType, type ChartedType } from './displacement-filter-context'
import { useMap } from '@/hooks/use-map'
import { DISPLACEMENT_LAYER_TYPES, DISPLACEMENT_TYPE_NAME, getStyleNameForType, isDisplacementLayerTitle, type DisplacementType } from './displacement-layers'
import { fetchDisplacementSldBins, type SldBin } from './displacement-sld-legend'


const SQM_TO_SQMI = 1 / 2_589_988.110336

// Round to 1 decimal place for popup display.
const fmt1 = (n: number): string => n.toFixed(1)

export const DISPLACEMENT_QUERY_KEY = ['stats', 'displacement-contours-review'] as const

// Resolve a charted type to its SLD style. Wraps getStyleNameForType so chart
// code can stay strict about charted types without falling back at every call.
function getChartedStyleName(type: ChartedType): string {
    const name = getStyleNameForType(type)
    if (!name) throw new Error(`No SLD style registered for charted type "${type}"`)
    return name
}

interface DisplacementProps {
    location: string
    type: DisplacementType
    year: string | null
    end_date?: string | null
    value_inch: number
}

export type DisplacementFeature = Feature<Polygon | MultiPolygon, DisplacementProps>

// Cumulative features carry null `year` and a period like "2017-10-20 to 2021-10-11";
// bucket them by the period's end year so the chart axis stays meaningful. Yearly
// uses its native `year` field.
export function getBucketYear(props: Pick<DisplacementProps, 'type' | 'year' | 'end_date'>): string | null {
    if (props.type === 'Yearly') return props.year ?? null
    if (props.type === 'Cumulative' && props.end_date) return props.end_date.slice(0, 4)
    return null
}

export async function fetchAllDisplacement(): Promise<DisplacementFeature[]> {
    const url = new URL(`${PROD_GEOSERVER_URL}/wfs`)
    url.searchParams.set('service', 'WFS')
    url.searchParams.set('version', '2.0.0')
    url.searchParams.set('request', 'GetFeature')
    url.searchParams.set('typeNames', DISPLACEMENT_TYPE_NAME)
    url.searchParams.set('outputFormat', 'application/json')
    url.searchParams.set('srsName', 'EPSG:4326')
    url.searchParams.set('count', '20000')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`WFS ${res.status}`)
    const data = await res.json() as FeatureCollection<Polygon | MultiPolygon, DisplacementProps>
    return data.features
}

// Popup-side: tiny chip explaining filter applicability per layer. Used by
// PopupContentWithPagination's layerHeaderExtras render-prop. Charts moved to
// the sidebar Stats slot — popup no longer carries whole-layer chart cards.
export function renderDisplacementLayerHeader(layer: LayerContentProps): React.ReactNode {
    return <LayerHeaderChip layer={layer} />
}

function LayerHeaderChip({ layer }: { layer: LayerContentProps }) {
    const { year } = useDisplacementFilters()
    const title = layer.layerTitle || layer.groupLayerTitle || ''
    const yearActive = year !== 'all'
    if (!yearActive) return null

    if (!isDisplacementLayerTitle(title)) {
        return (
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <span>Outside Water Year filter</span>
            </div>
        )
    }

    const typeValue = DISPLACEMENT_LAYER_TYPES[title]
    if (!isChartedType(typeValue) || typeValue === 'Cumulative') {
        return (
            <div className="mb-2 inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                <span>Period-keyed · Water Year does not apply</span>
            </div>
        )
    }

    return null
}

// Sidebar-side: full whole-layer chart card (KPIs + stacked bar) rendered inside
// each charted displacement layer's accordion via the Stats toggle.
export function renderDisplacementLayerStats(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const typeValue = DISPLACEMENT_LAYER_TYPES[layerTitle]
    if (!isChartedType(typeValue)) return null
    return <DisplacementLayerCharts typeValue={typeValue} />
}

// Locate which SldBin a feature's signed value_inch falls into. Half-open on the
// upper bound matches the SLD's "value_inch < X" semantics so each feature
// resolves to exactly one bin.
export function findBin(bins: SldBin[], v: number): SldBin | undefined {
    return bins.find(b => v >= b.min && v < b.max)
}

// Compute [minLng, minLat, maxLng, maxLat] across a feature collection without
// pulling in turf. Walks Polygon/MultiPolygon coordinate trees recursively.
function combinedBbox(features: DisplacementFeature[]): [number, number, number, number] | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const visit = (node: unknown): void => {
        if (Array.isArray(node) && typeof node[0] === 'number' && typeof node[1] === 'number') {
            const x = node[0], y = node[1]
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        } else if (Array.isArray(node)) {
            for (const child of node) visit(child)
        }
    }
    for (const f of features) {
        if (f.geometry?.coordinates) visit(f.geometry.coordinates)
    }
    return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null
}

function DisplacementLayerCharts({ typeValue }: { typeValue: ChartedType }) {
    const { year, basinsByType } = useDisplacementFilters()
    const effective = useEffectiveThresholdsIn()
    const thresholdIn = effective[typeValue]
    const styleName = getChartedStyleName(typeValue)
    const selectedBasins = basinsByType[typeValue]

    const { data: features = [], isLoading: featuresLoading, isError } = useQuery({
        queryKey: DISPLACEMENT_QUERY_KEY,
        queryFn: fetchAllDisplacement,
        staleTime: 10 * 60 * 1000,
    })

    // Bins come from the SLD's own classification so the chart matches the map.
    // Excluded the 'Zero' deadband for plotting since features in it aren't
    // subsiding meaningfully — they're folded into the threshold filter logic.
    const { data: sldBins = [], isLoading: binsLoading } = useQuery({
        queryKey: ['sld-bins', styleName],
        queryFn: () => fetchDisplacementSldBins(styleName),
        staleTime: 60 * 60 * 1000,
    })

    const plotBins = useMemo(() => sldBins.filter(b => !b.isZero), [sldBins])
    const isLoading = featuresLoading || binsLoading

    // Scope to this type AND any selected basins. Empty basin set = all basins.
    const scoped = useMemo(
        () => features.filter(f => {
            if (f.properties.type !== typeValue) return false
            if (selectedBasins.size > 0 && !selectedBasins.has(f.properties.location)) return false
            return true
        }),
        [features, typeValue, selectedBasins]
    )

    // Cumulative features have no `year` (period-keyed instead); skip year filter
    // for that type so its KPIs/chart aren't zeroed out by a year selection.
    const ignoreYear = typeValue === 'Cumulative'
    const filtered = useMemo(() => {
        return scoped.filter(f => {
            if (!ignoreYear && year !== 'all' && f.properties.year !== year) return false
            return true
        })
    }, [scoped, year, ignoreYear])

    const yearAxisLabel = typeValue === 'Cumulative' ? 'Period End Year' : 'Water Year'

    const overThreshold = useMemo(
        () => filtered.filter(f => Math.abs(f.properties.value_inch) >= thresholdIn),
        [filtered, thresholdIn]
    )

    const totalAreaSqMi = useMemo(
        () => overThreshold.reduce((acc, f) => acc + area(f) * SQM_TO_SQMI, 0),
        [overThreshold]
    )

    const maxDisplacement = useMemo(() => {
        let max = 0
        for (const f of filtered) {
            const v = Math.abs(f.properties.value_inch)
            if (v > max) max = v
        }
        return max
    }, [filtered])

    const distinctBasins = useMemo(() => new Set(filtered.map(f => f.properties.location)).size, [filtered])

    const period = useMemo(() => {
        const yrs = filtered.map(f => getBucketYear(f.properties)).filter((y): y is string => Boolean(y))
        if (yrs.length === 0) return null
        return { from: yrs.reduce((a, b) => a < b ? a : b), to: yrs.reduce((a, b) => a > b ? a : b) }
    }, [filtered])

    const stackedAreaByYear = useMemo(() => {
        const yearToBins = new Map<string, Record<string, number>>()
        for (const f of scoped) {
            const v = f.properties.value_inch
            if (Math.abs(v) < thresholdIn) continue
            const bin = findBin(plotBins, v)
            if (!bin) continue
            const y = getBucketYear(f.properties)
            if (!y) continue
            if (!yearToBins.has(y)) yearToBins.set(y, {})
            const a = area(f) * SQM_TO_SQMI
            const buckets = yearToBins.get(y)!
            buckets[bin.name] = (buckets[bin.name] ?? 0) + a
        }
        return Array.from(yearToBins, ([year, b]) => ({ year, ...b }))
            .sort((a, b) => a.year.localeCompare(b.year))
    }, [scoped, thresholdIn, plotBins])

    // Per-basin total subsiding area: sum mi² of features above threshold per
    // location. Tracks each basin's deepest contour so the bar can be colored
    // by the SLD bin that matches the map. All basins included, sorted by area
    // descending so the worst basins surface first on the X axis.
    const basinAreas = useMemo(() => {
        const byLocation = new Map<string, { area: number; signed: number; abs: number; features: DisplacementFeature[] }>()
        for (const f of scoped) {
            const loc = f.properties.location
            if (!loc) continue
            const v = f.properties.value_inch
            const a = Math.abs(v)
            if (a < thresholdIn) continue
            const sqMi = area(f) * SQM_TO_SQMI
            const cur = byLocation.get(loc)
            if (!cur) {
                byLocation.set(loc, { area: sqMi, signed: v, abs: a, features: [f] })
            } else {
                cur.area += sqMi
                cur.features.push(f)
                if (a > cur.abs) {
                    cur.signed = v
                    cur.abs = a
                }
            }
        }
        return Array.from(byLocation, ([location, { area: areaSqMi, signed, features: locFeatures }]) => ({
            location,
            area: Number(fmt1(areaSqMi)),
            features: locFeatures,
            bin: findBin(plotBins, signed),
        })).sort((a, b) => b.area - a.area)
    }, [scoped, plotBins, thresholdIn])

    const { map } = useMap()
    function zoomToBasin(features: DisplacementFeature[]) {
        if (!map || features.length === 0) return
        const bb = combinedBbox(features)
        if (!bb) return
        const [minX, minY, maxX, maxY] = bb
        map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: 12, duration: 600 })
    }

    if (isError) return <div className="text-xs text-destructive mb-2">Failed to load stats.</div>

    return (
        <div className="mb-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
                <KPI label="Subsiding Area" value={isLoading ? '—' : `${fmt1(totalAreaSqMi)} mi²`} sub={`|value| ≥ ${fmt1(thresholdIn)} in`} />
                <KPI label="Max |value|" value={isLoading ? '—' : `${fmt1(maxDisplacement)} in`} sub={typeValue} />
                <KPI label="Basins" value={isLoading ? '—' : String(distinctBasins)} sub="distinct in filter" />
                <KPI label="Period" value={isLoading ? '—' : (period ? `${period.from} – ${period.to}` : '—')} sub="years covered" />
            </div>

            <div>
                <h4 className="text-xs font-medium mb-1">Subsiding Area by {yearAxisLabel}</h4>
                <p className="text-[10px] text-muted-foreground mb-1">Stacked by SLD bin (in). Bin breaks + colors match the map's {styleName} style. Year filter does not apply.</p>
                <div className="h-56 w-full">
                    {isLoading ? <Skeleton className="h-full w-full" /> : (
                        <ResponsiveContainer>
                            <BarChart data={stackedAreaByYear} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                <XAxis dataKey="year" stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} height={20} />
                                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} unit=" mi²" width={75} tickMargin={4}>
                                    <RechartsLabel value="Subsiding Area (mi²)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                </YAxis>
                                <Tooltip
                                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                    cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                                    formatter={(v, name) => [`${typeof v === 'number' ? fmt1(v) : v} mi²`, name]}
                                />
                                {plotBins.map(bin => (
                                    <Bar key={bin.name} dataKey={bin.name} stackId="rate" fill={bin.color} name={bin.title} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-foreground">
                    {plotBins.map(bin => (
                        <div key={bin.name} className="flex items-center gap-1">
                            <span
                                className="inline-block h-2.5 w-2.5 ring-1 ring-foreground/40"
                                style={{ background: bin.color }}
                                aria-hidden
                            />
                            <span>{bin.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h4 className="text-xs font-medium mb-1">Subsiding Area by Basin</h4>
                <p className="text-[10px] text-muted-foreground mb-1">Each bar is one basin's total area above threshold. Colored by the SLD bin of that basin's deepest contour. Click a bar to zoom the map to that basin.</p>
                <div className="h-56 w-full">
                    {isLoading ? <Skeleton className="h-full w-full" /> : basinAreas.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No basins above threshold.</p>
                    ) : (
                        <ResponsiveContainer>
                            <BarChart data={basinAreas} margin={{ top: 4, right: 4, bottom: 48, left: 0 }}>
                                <CartesianGrid stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="location"
                                    stroke="currentColor"
                                    tick={{ fill: 'currentColor', fontSize: 10 }}
                                    interval={0}
                                    angle={-35}
                                    textAnchor="end"
                                    height={56}
                                />
                                <YAxis stroke="currentColor" tick={{ fill: 'currentColor', fontSize: 11 }} unit=" mi²" width={75} tickMargin={4}>
                                    <RechartsLabel value="Subsiding Area (mi²)" angle={-90} position="insideLeft" style={{ fontSize: 11, fill: 'currentColor', textAnchor: 'middle' }} />
                                </YAxis>
                                <Tooltip
                                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                    cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                                    formatter={(v) => [`${typeof v === 'number' ? fmt1(v) : v} mi²`, 'subsiding area']}
                                />
                                <Bar dataKey="area" onClick={(_, idx) => zoomToBasin(basinAreas[idx].features)} style={{ cursor: 'pointer' }}>
                                    {basinAreas.map(b => (
                                        <Cell key={b.location} fill={b.bin?.color ?? 'hsl(var(--muted-foreground))'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    )
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <Card>
            <CardHeader className="p-2 pb-0">
                <CardTitle className="text-[10px] font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <div className="text-sm font-semibold">{value}</div>
                {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
            </CardContent>
        </Card>
    )
}
