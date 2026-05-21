import { useCallback, useMemo } from 'react'
import { FeatureCard, RasterOnlyCard } from '@/components/maps/popups/popup-content-with-pagination'
import { hasRasterData, type ExtendedFeature, type LayerContentProps } from '@/components/maps/popups/types'
import { useGetPopupButtons } from '@/hooks/use-get-popup-buttons'
import { useBulkRelatedTable } from '@/hooks/use-bulk-related-table'
import { useZoomToFeature } from '@/hooks/use-zoom-to-feature'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SummaryReportProps {
    cards: LayerContentProps[]
    /** Currently spotlit feature id (drives map paint + section card emphasis). */
    highlightedFeatureId: string | number | null
    onHighlightChange: (id: string | number | null) => void
    /** Currently scoped layer (null = show all sections / no map filter). */
    selectedLayerTitle: string | null
    onSelectedLayerChange: (title: string | null) => void
}

/**
 * Report-style content for the summary route. Replaces the popup pager UI
 * when a fresh selection lands on `/summary`. Per-layer sections with
 * card-per-feature, layer pill toggles at the top, and tight coordination
 * with the side `SummaryMap` (layer filter + feature spotlight).
 */
export function SummaryReport({
    cards,
    highlightedFeatureId,
    onHighlightChange,
    selectedLayerTitle,
    onSelectedLayerChange,
}: SummaryReportProps) {
    const { zoomTo } = useZoomToFeature({
        onHighlightChange: (features) => {
            onHighlightChange(features[0]?.id ?? null)
        },
    })
    const buttons = useGetPopupButtons()

    const visibleCards = useMemo(
        () => selectedLayerTitle === null
            ? cards
            : cards.filter(c => c.layerTitle === selectedLayerTitle),
        [cards, selectedLayerTitle],
    )

    // Bulk-fetch related tables across every visible layer, single round trip.
    const bulkFetchConfig = useMemo(() => {
        const layerWithRelated = visibleCards.find(l => l.relatedTables?.length)
        if (!layerWithRelated?.relatedTables) return { tables: undefined, values: [] as string[] }
        const allTargetValues: string[] = []
        for (const layer of visibleCards) {
            if (!layer.relatedTables?.length) continue
            for (const feature of layer.features) {
                for (const table of layer.relatedTables) {
                    const v = feature.properties?.[table.targetField]
                    if (v) allTargetValues.push(String(v))
                }
            }
        }
        return { tables: layerWithRelated.relatedTables, values: allTargetValues }
    }, [visibleCards])

    const { dataByTable: bulkRelatedData } = useBulkRelatedTable(
        bulkFetchConfig.tables,
        bulkFetchConfig.values,
    )

    const handleZoomToFeature = useCallback(
        (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => {
            zoomTo(feature, sourceCRS, { maxZoom: maxZoomLevel })
            // Force the spotlight onto the clicked feature even if the zoom hook
            // didn't run a highlight (e.g. missing geometry guards).
            if (feature.id !== undefined && feature.id !== null) {
                onHighlightChange(feature.id as string | number)
            }
        },
        [zoomTo, onHighlightChange],
    )

    const totalFeatures = useMemo(
        () => cards.reduce((acc, c) => acc + c.features.length, 0),
        [cards],
    )

    if (cards.length === 0) return null

    return (
        <div className="flex flex-col gap-4 p-4">
            <LayerPills
                cards={cards}
                selectedLayerTitle={selectedLayerTitle}
                onSelect={onSelectedLayerChange}
                totalFeatures={totalFeatures}
            />

            {visibleCards.map(card => (
                <LayerSection
                    key={card.layerTitle}
                    card={card}
                    highlightedFeatureId={highlightedFeatureId}
                    onHighlightFeature={onHighlightChange}
                    handleZoomToFeature={handleZoomToFeature}
                    bulkRelatedData={bulkRelatedData}
                    buttons={buttons}
                />
            ))}
        </div>
    )
}

interface LayerPillsProps {
    cards: LayerContentProps[]
    selectedLayerTitle: string | null
    onSelect: (title: string | null) => void
    totalFeatures: number
}

function LayerPills({ cards, selectedLayerTitle, onSelect, totalFeatures }: LayerPillsProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Pill
                active={selectedLayerTitle === null}
                onClick={() => onSelect(null)}
                label="All"
                count={totalFeatures}
            />
            {cards.map(card => {
                const count = card.features.length + (card.features.length === 0 && hasRasterData(card) ? 1 : 0)
                return (
                    <Pill
                        key={card.layerTitle}
                        active={selectedLayerTitle === card.layerTitle}
                        onClick={() => onSelect(card.layerTitle)}
                        label={card.layerTitle}
                        count={count}
                    />
                )
            })}
        </div>
    )
}

function Pill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
            )}
        >
            <span className="truncate max-w-[16rem]">{label}</span>
            <Badge variant={active ? 'secondary' : 'outline'} className="h-4 px-1 text-[9px] tabular-nums">
                {count}
            </Badge>
        </button>
    )
}

interface LayerSectionProps {
    card: LayerContentProps
    highlightedFeatureId: string | number | null
    onHighlightFeature: (id: string | number | null) => void
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => void
    bulkRelatedData: ReturnType<typeof useBulkRelatedTable>['dataByTable']
    buttons: ReturnType<typeof useGetPopupButtons>
}

function LayerSection({
    card,
    highlightedFeatureId,
    onHighlightFeature,
    handleZoomToFeature,
    bulkRelatedData,
    buttons,
}: LayerSectionProps) {
    const isRaster = card.features.length === 0 && hasRasterData(card)
    const sectionAnchor = useMemo(() => slug(card.layerTitle), [card.layerTitle])

    return (
        <section id={`layer-${sectionAnchor}`} className="flex flex-col gap-2">
            <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
                <h2 className="text-sm font-semibold text-foreground">{card.layerTitle}</h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {isRaster ? 'raster data' : `${card.features.length} ${card.features.length === 1 ? 'feature' : 'features'}`}
                </span>
            </header>

            {isRaster ? (
                <RasterOnlyCard layer={card} />
            ) : (
                card.features.map(feature => {
                    const isHighlighted = highlightedFeatureId !== null && feature.id === highlightedFeatureId
                    return (
                        <div
                            key={String(feature.id)}
                            onMouseEnter={() => onHighlightFeature(feature.id as string | number)}
                            className={cn(
                                'rounded-lg transition-all',
                                isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                            )}
                        >
                            <FeatureCard
                                layer={card}
                                feature={feature}
                                buttons={buttons}
                                handleZoomToFeature={handleZoomToFeature}
                                bulkRelatedData={bulkRelatedData}
                            />
                        </div>
                    )
                })
            )}
        </section>
    )
}

function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
