import { useMemo, useState, memo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Shrink } from "lucide-react"
import { Pager } from "@/components/ui/pager"
import { PopupContentDisplay } from "@/components/maps/popups/popup-content-display"
import { useGetPopupButtons } from "@/hooks/use-get-popup-buttons"
import { useZoomToFeature } from "@/hooks/use-zoom-to-feature"
import { loadCogMetadata, computeCogPixelPolygon } from "@/hooks/use-cog-metadata"
import { HIGHLIGHT_COLORS } from "@/lib/map/cog/setup"
import type { HighlightFeature } from "@/components/maps/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useBulkRelatedTable, RelatedDataMap } from "@/hooks/use-bulk-related-table"
import type { RelatedTable } from "@/lib/types/mapping-types"
import { ExtendedFeature, LayerContentProps, hasRasterData, getLayerCountText } from "./types"

const POPUP_PAGE_SIZE = 10

interface PopupButtonsProps {
    feature: ExtendedFeature;
    sourceCRS: string;
    maxZoomLevel?: number;
    onZoom: (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => void;
    extraButtons: React.ReactNode[] | null;
}

const PopupButtons = memo(({ feature, sourceCRS, maxZoomLevel, onZoom, extraButtons }: PopupButtonsProps) => (
    <div className="flex justify-start gap-2">
        <Button variant="ghost" onClick={() => onZoom(feature, sourceCRS, maxZoomLevel)} className="flex gap-x-2">
            <Shrink className="h-5 w-5" />
            <span className="hidden md:flex">Zoom to Feature</span>
            <span className="md:hidden">Zoom</span>
        </Button>
        {extraButtons && extraButtons.map((button) => button)}
    </div>
));
PopupButtons.displayName = 'PopupButtons';

interface PopupContentWithPaginationProps {
    layerContent: LayerContentProps[]
    onHighlightChange?: (features: HighlightFeature[]) => void
    clickPoint?: { lng: number; lat: number } | null
}

const FeatureCard = memo(({
    layer,
    feature,
    buttons,
    handleZoomToFeature,
    bulkRelatedData,
    relatedLoading,
}: {
    layer: LayerContentProps,
    feature: ExtendedFeature,
    buttons: React.ReactNode[] | null,
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => void,
    bulkRelatedData?: RelatedDataMap[],
    relatedLoading?: boolean,
}) => {
    return (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-card shadow-sm">
            <PopupButtons
                feature={feature}
                sourceCRS={layer.sourceCRS}
                maxZoomLevel={layer.maxZoomLevel}
                onZoom={handleZoomToFeature}
                extraButtons={buttons}
            />
            <PopupContentDisplay
                layer={layer}
                feature={feature}
                layout={layer.popupFields &&
                    Object.keys(layer.popupFields).length > 5 ? "grid" : "stacked"}
                bulkRelatedData={bulkRelatedData}
                relatedLoading={relatedLoading}
            />
        </div>
    )
});
FeatureCard.displayName = 'FeatureCard';

// Renders a layer's features with internal pagination so popup DOM stays small
// even when layer.features has thousands of entries (cap is 10k per WFS query).
const PaginatedFeatureList = memo(({
    layer,
    buttons,
    handleZoomToFeature,
    bulkRelatedData,
    relatedLoading,
}: {
    layer: LayerContentProps,
    buttons: React.ReactNode[] | null,
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => void,
    bulkRelatedData?: RelatedDataMap[],
    relatedLoading?: boolean,
}) => {
    const [page, setPage] = useState(0)
    const total = layer.features.length
    const totalPages = Math.max(1, Math.ceil(total / POPUP_PAGE_SIZE))
    const safePage = Math.min(page, totalPages - 1)
    const start = safePage * POPUP_PAGE_SIZE
    const end = Math.min(start + POPUP_PAGE_SIZE, total)
    const slice = useMemo(() => layer.features.slice(start, end), [layer.features, start, end])

    return (
        <>
            <Pager
                page={safePage}
                totalPages={totalPages}
                total={total}
                pageSize={POPUP_PAGE_SIZE}
                onPageChange={setPage}
                className="pb-1"
            />
            {slice.map((feature, idx) => (
                <FeatureCard
                    key={`${feature.id ?? start + idx}`}
                    layer={layer}
                    feature={feature}
                    buttons={buttons}
                    handleZoomToFeature={handleZoomToFeature}
                    bulkRelatedData={bulkRelatedData}
                    relatedLoading={relatedLoading}
                />
            ))}
        </>
    )
})
PaginatedFeatureList.displayName = 'PaginatedFeatureList'

// Raster-only card for layers with no vector features but with raster data.
// COG layers get a "Zoom to Pixel" button — snaps click to COG's grid and zooms to that cell.
const RasterOnlyCard = memo(({
    layer, clickPoint, onZoomToPixel,
}: {
    layer: LayerContentProps
    clickPoint?: { lng: number; lat: number } | null
    onZoomToPixel?: (layer: LayerContentProps, clickPoint: { lng: number; lat: number }) => void
}) => {
    const showZoomButton = layer.sourceKind === 'cog' && clickPoint && onZoomToPixel
    return (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-card shadow-sm">
            <PopupContentDisplay
                layer={layer}
                feature={undefined}
                layout="stacked"
            />
            {showZoomButton && (
                <Button variant="ghost" onClick={() => onZoomToPixel(layer, clickPoint)} className="flex gap-x-2">
                    <Shrink className="h-5 w-5" />
                    <span className="hidden md:flex">Zoom to Pixel</span>
                    <span className="md:hidden">Zoom</span>
                </Button>
            )}
        </div>
    )
});
RasterOnlyCard.displayName = 'RasterOnlyCard';

const PopupContentWithPaginationInner = ({ layerContent, onHighlightChange, clickPoint }: PopupContentWithPaginationProps) => {
    const { zoomTo } = useZoomToFeature({ onHighlightChange })

    const handleZoomToPixel = useCallback(async (layer: LayerContentProps, point: { lng: number; lat: number }) => {
        const cogUrl = layer.rasterSource?.url
        if (!cogUrl) return
        const metadata = await loadCogMetadata(cogUrl)
        if (!metadata) return
        const polygon = computeCogPixelPolygon(point, metadata)
        if (!polygon) return
        zoomTo({
            type: 'Feature',
            id: `${layer.layerTitle}-pixel`,
            geometry: polygon,
            properties: {},
            namespace: layer.layerTitle,
        }, 'EPSG:4326', { maxZoom: 16 })
    }, [zoomTo])
    const buttons = useGetPopupButtons()
    // -1 = "All", 0+ = specific layer index
    const [selectedLayerIndex, setSelectedLayerIndex] = useState(-1)

    // Track content key to reset to "All" when content changes
    const layerKey = useMemo(
        () => layerContent.map(l => `${l.groupLayerTitle}|${l.layerTitle}`).join(','),
        [layerContent]
    )
    const prevLayerKeyRef = useRef(layerKey)

    // Reset to "All" and highlight first feature when content changes
    if (prevLayerKeyRef.current !== layerKey) {
        prevLayerKeyRef.current = layerKey
        setSelectedLayerIndex(-1)
        // Highlight first feature of new content
        if (layerContent.length > 0 && layerContent[0].features.length > 0) {
            const firstFeature = layerContent[0].features[0]
            if (firstFeature.geometry) {
                onHighlightChange?.([{
                    id: firstFeature.id as string | number,
                    geometry: firstFeature.geometry,
                    properties: firstFeature.properties || {}
                }])
            }
        }
    }

    // Total count across all layers (includes raster-only as 1)
    const totalCount = useMemo(() => {
        let count = 0
        for (const layer of layerContent) {
            count += layer.features?.length || 0
            // Count raster-only layers as 1 result
            if (layer.features.length === 0 && hasRasterData(layer)) {
                count += 1
            }
        }
        return count
    }, [layerContent])

    // Each layer entry can carry its own related-table configs (e.g. a layer with mixed-geometry
    // sublayers, where points and polygons have different related tables). Flatten every layer's
    // tables into one list, record each layer's slice offset, and gather target values per table
    // from its owning layer's features — so layers no longer have to share one related-table config.
    const { allTables, layerOffsets, valuesByTable } = useMemo(() => {
        const allTables: RelatedTable[] = []
        const layerOffsets: number[] = []
        const valuesByTable: string[][] = []
        for (const layer of layerContent) {
            layerOffsets.push(allTables.length)
            for (const table of layer.relatedTables ?? []) {
                allTables.push(table)
                // Values for this table come only from its owning layer's features.
                valuesByTable.push(
                    layer.features
                        .map(f => f.properties?.[table.targetField!])
                        .filter(Boolean)
                        .map(String)
                )
            }
        }
        return { allTables, layerOffsets, valuesByTable }
    }, [layerContent])

    // Bulk fetch related data for all features at once
    const { dataByTable: bulkRelatedData, isLoading: relatedLoading } = useBulkRelatedTable(
        allTables.length ? allTables : undefined,
        valuesByTable
    )

    // Slice the flat bulk result back to a single layer's related tables, aligned to its config order.
    const bulkForLayer = useCallback((layerIdx: number, layer: LayerContentProps): RelatedDataMap[] | undefined => {
        const count = layer.relatedTables?.length ?? 0
        if (!count) return undefined
        const offset = layerOffsets[layerIdx] ?? 0
        return bulkRelatedData.slice(offset, offset + count)
    }, [bulkRelatedData, layerOffsets])

    // Handle layer change via dropdown
    const handleLayerChange = useCallback((index: number) => {
        setSelectedLayerIndex(index)
        // Highlight first feature of selected layer (or first layer if "All")
        const targetLayer = index === -1 ? layerContent[0] : layerContent[index]
        if (targetLayer?.features.length > 0 && targetLayer.features[0].geometry) {
            onHighlightChange?.([{
                id: targetLayer.features[0].id as string | number,
                geometry: targetLayer.features[0].geometry,
                properties: targetLayer.features[0].properties || {}
            }])
        }
    }, [layerContent, onHighlightChange])

    const handleZoomToFeature = (feature: ExtendedFeature, sourceCRS: string, maxZoomLevel?: number) => {
        zoomTo(feature, sourceCRS, { maxZoom: maxZoomLevel })
    }

    // If no layers, return null
    if (layerContent.length === 0) return null;

    // Determine what to show
    const showAll = selectedLayerIndex === -1
    const selectedLayer = showAll ? null : layerContent[selectedLayerIndex]

    return (
        <div className="flex flex-col gap-3 select-text">
            {/* Layer dropdown */}
            <div className="px-2">
                <TooltipProvider>
                    <Select
                        value={String(selectedLayerIndex)}
                        onValueChange={(value) => handleLayerChange(Number(value))}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                                {selectedLayerIndex === -1
                                    ? `All (${totalCount} result${totalCount !== 1 ? 's' : ''})`
                                    : `${layerContent[selectedLayerIndex]?.layerTitle || layerContent[selectedLayerIndex]?.groupLayerTitle} (${layerContent[selectedLayerIndex] ? getLayerCountText(layerContent[selectedLayerIndex]) : '0 features'})`
                                }
                            </TooltipContent>
                        </Tooltip>
                        <SelectContent>
                            <SelectItem value="-1">
                                All ({totalCount} result{totalCount !== 1 ? 's' : ''})
                            </SelectItem>
                            {layerContent.map((layer, index) => {
                                const title = layer.layerTitle || layer.groupLayerTitle
                                return (
                                    <SelectItem key={`${title}-${index}`} value={String(index)}>
                                        {title} ({getLayerCountText(layer)})
                                    </SelectItem>
                                )
                            })}
                        </SelectContent>
                    </Select>
                </TooltipProvider>
            </div>

            {/* Features list */}
            <div className="space-y-3 px-2">
                {showAll ? (
                    // Show all features grouped by layer
                    layerContent.map((layer, layerIdx) => {
                        const hasFeatures = layer.features.length > 0;
                        const hasRaster = hasRasterData(layer);

                        // Skip layers with neither features nor raster data
                        if (!hasFeatures && !hasRaster) return null;

                        return (
                            <div key={`${layer.groupLayerTitle}-${layer.layerTitle}-${layerIdx}`}>
                                {/* Layer header — yellow swatch only on COG items, matching the on-map pixel highlight. */}
                                <div className="text-base font-bold text-primary mb-2 px-1 flex items-center gap-2">
                                    {layer.sourceKind === 'cog' && (
                                        <span
                                            aria-hidden
                                            title="Sampled COG pixel"
                                            className="inline-block h-2.5 w-2.5 rounded-sm border border-black/30"
                                            style={{ backgroundColor: HIGHLIGHT_COLORS.cog }}
                                        />
                                    )}
                                    <span><span className="uppercase tracking-wide">Layer:</span> <span className="capitalize">{layer.layerTitle || layer.groupLayerTitle}</span></span>
                                </div>
                                {/* Features or raster-only content */}
                                <div className="space-y-2">
                                    {hasFeatures ? (
                                        <PaginatedFeatureList
                                            layer={layer}
                                            buttons={buttons}
                                            handleZoomToFeature={handleZoomToFeature}
                                            bulkRelatedData={bulkForLayer(layerIdx, layer)}
                                            relatedLoading={layer.relatedTables?.length ? relatedLoading : false}
                                        />
                                    ) : hasRaster ? (
                                        <RasterOnlyCard layer={layer} clickPoint={clickPoint} onZoomToPixel={handleZoomToPixel} />
                                    ) : null}
                                </div>
                            </div>
                        );
                    })
                ) : selectedLayer ? (
                    <div className="space-y-2">
                        {selectedLayer.features.length > 0 ? (
                            <PaginatedFeatureList
                                layer={selectedLayer}
                                buttons={buttons}
                                handleZoomToFeature={handleZoomToFeature}
                                bulkRelatedData={bulkForLayer(selectedLayerIndex, selectedLayer)}
                                relatedLoading={selectedLayer.relatedTables?.length ? relatedLoading : false}
                            />
                        ) : hasRasterData(selectedLayer) ? (
                            <RasterOnlyCard layer={selectedLayer} clickPoint={clickPoint} onZoomToPixel={handleZoomToPixel} />
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

const PopupContentWithPagination = memo(PopupContentWithPaginationInner);
PopupContentWithPagination.displayName = 'PopupContentWithPagination';

export { PopupContentWithPagination };