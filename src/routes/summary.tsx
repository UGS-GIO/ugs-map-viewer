import { useCallback, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import type maplibregl from 'maplibre-gl'
import { ArrowLeftIcon, Loader2 } from 'lucide-react'
import { MapContext } from '@/context/map-context'
import { useSummaryFeatures } from './-summary/-hooks/use-summary-features'
import { SummaryMap } from './-summary/-components/summary-map'
import { SummaryReport } from './-summary/-components/summary-report'

const summarySearchSchema = z.object({
    /** Comma-separated `layer:id` pairs — same shape as the _map route's `features` param. */
    features: z.string().optional().default(''),
}).strip()

export const Route = createFileRoute('/summary')({
    validateSearch: summarySearchSchema,
    component: SummaryPage,
})

function SummaryPage() {
    const { features } = Route.useSearch()
    const { cards, refs, isLoading, fromStash } = useSummaryFeatures(features)
    const router = useRouter()

    const [summaryMap, setSummaryMap] = useState<maplibregl.Map | null>(null)
    const [selectedLayerTitle, setSelectedLayerTitle] = useState<string | null>(null)
    const [highlightedFeatureId, setHighlightedFeatureId] = useState<string | number | null>(null)

    const handleMapReady = useCallback((map: maplibregl.Map) => setSummaryMap(map), [])

    // Browser-history back so the user lands on the exact map state they came
    // from (zoom, layers, click bbox, etc.) rather than the app home page.
    // Fallback to the root if the history stack is empty (e.g. opened the
    // summary URL directly in a new tab).
    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            router.history.back()
        } else {
            router.navigate({ to: '/' })
        }
    }, [router])

    const featureCount = cards.length > 0
        ? cards.reduce((acc, c) => acc + c.features.length, 0)
        : refs.length
    const layerCount = cards.length > 0
        ? new Set(cards.map(c => c.layerTitle)).size
        : new Set(refs.map(r => r.layerTitle)).size

    return (
        <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span>Back</span>
                    </button>
                    <div className="h-6 w-px bg-border" />
                    <div>
                        <h1 className="text-sm font-semibold">Feature summary</h1>
                        <p className="text-[11px] text-muted-foreground">
                            {featureCount} {featureCount === 1 ? 'feature' : 'features'} across {layerCount} {layerCount === 1 ? 'layer' : 'layers'}
                        </p>
                    </div>
                </div>
                {fromStash && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Refreshing from source…
                    </span>
                )}
            </header>

            <div className="grid flex-1 min-h-0 grid-cols-1 md:grid-cols-2">
                <section className="overflow-y-auto border-r border-border bg-muted/30">
                    {cards.length > 0 ? (
                        // Provide the summary map as the MapContext map so existing
                        // hooks (useZoomToFeature) inside FeatureCard resolve to it
                        // without a per-route shim.
                        <MapContext.Provider value={mapContextValue(summaryMap)}>
                            <SummaryReport
                                cards={cards}
                                highlightedFeatureId={highlightedFeatureId}
                                onHighlightChange={setHighlightedFeatureId}
                                selectedLayerTitle={selectedLayerTitle}
                                onSelectedLayerChange={setSelectedLayerTitle}
                            />
                        </MapContext.Provider>
                    ) : isLoading ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <p className="text-sm">Loading selection…</p>
                        </div>
                    ) : refs.length > 0 ? (
                        <DegradedSelectionList refs={refs} />
                    ) : (
                        <EmptyState />
                    )}
                </section>

                <section className="relative bg-muted/10">
                    {cards.length > 0 ? (
                        <SummaryMap
                            cards={cards}
                            selectedLayerTitle={selectedLayerTitle}
                            highlightedFeatureId={highlightedFeatureId}
                            onMapReady={handleMapReady}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                            {isLoading ? 'Loading map…' : 'Map appears once content is loaded.'}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <p className="text-sm">No features in this summary.</p>
            <p className="text-xs">Select features on the map and choose &ldquo;Expand&rdquo; from the popup.</p>
        </div>
    )
}

function DegradedSelectionList({ refs }: { refs: ReturnType<typeof useSummaryFeatures>['refs'] }) {
    return (
        <div className="flex flex-col gap-2 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selection (read-only)</p>
            <p className="text-[11px] text-muted-foreground">
                The shareable URL only carries layer + feature IDs. Open the summary via the popup&apos;s Expand button to see fields, related tables, and photos.
            </p>
            <ul className="flex flex-col gap-1.5">
                {refs.map(r => (
                    <li
                        key={`${r.layerTitle}:${r.featureId}`}
                        className="rounded border border-border bg-card px-3 py-2 text-xs"
                    >
                        <div className="font-medium">{r.layerTitle}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">id: {r.featureId}</div>
                    </li>
                ))}
            </ul>
        </div>
    )
}

/**
 * Build a MapContext value backed by the summary map. Most fields are no-ops
 * since the summary page doesn't host the app's drawing/layer-toggle UI —
 * only the `map` slot matters for things like {@link useZoomToFeature}.
 */
function mapContextValue(map: maplibregl.Map | null) {
    return {
        map: map ?? undefined,
        isSketching: false,
        setIsSketching: () => { },
        onLayerTurnedOff: () => { },
        activeDrawShape: 'off' as const,
        startDraw: () => { },
        cancelDraw: () => { },
        handleDrawComplete: () => false,
        registerPrepareForDraw: () => { },
        registerLayerTurnedOff: () => { },
        onMapReady: () => { },
    }
}
