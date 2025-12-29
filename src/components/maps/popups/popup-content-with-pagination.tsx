import { useMemo, useState, memo, useCallback, useRef } from "react"
import { Feature, Geometry, GeoJsonProperties } from "geojson"
import { Button } from "@/components/ui/button"
import { Shrink } from "lucide-react"
import { PopupContentDisplay } from "@/components/maps/popups/popup-content-display"
import { ColorCodingRecordFunction, FieldConfig, LinkFields, ProcessedRasterSource, RelatedTable } from "@/lib/types/mapping-types"
import { useMap } from "@/hooks/use-map"
import { useGetPopupButtons } from "@/hooks/use-get-popup-buttons"
import { zoomToFeature } from "@/lib/map/utils"
import type { HighlightFeature } from "@/components/maps/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useBulkRelatedTable, RelatedDataMap } from "@/hooks/use-bulk-related-table"


// Extracted outside to prevent recreation on every render
interface PopupButtonsProps {
    feature: ExtendedFeature;
    sourceCRS: string;
    title: string;
    onZoom: (feature: ExtendedFeature, sourceCRS: string, title: string) => void;
    extraButtons: React.ReactNode[] | null;
}

const PopupButtons = memo(({ feature, sourceCRS, title, onZoom, extraButtons }: PopupButtonsProps) => (
    <div className="flex justify-start gap-2">
        <Button variant="ghost" onClick={() => onZoom(feature, sourceCRS, title)} className="flex gap-x-2">
            <Shrink className="h-5 w-5" />
            <span className="hidden md:flex">Zoom to Feature</span>
            <span className="md:hidden">Zoom</span>
        </Button>
        {extraButtons && extraButtons.map((button) => button)}
    </div>
));
PopupButtons.displayName = 'PopupButtons';

export interface ExtendedFeature extends Feature<Geometry, GeoJsonProperties> {
    namespace: string;
}

export interface LayerContentProps {
    groupLayerTitle: string
    layerTitle: string
    features: ExtendedFeature[]
    sourceCRS: string; // (e.g., "EPSG:26912")
    popupFields?: Record<string, FieldConfig>
    relatedTables?: RelatedTable[]
    linkFields?: LinkFields
    colorCodingMap?: ColorCodingRecordFunction
    customLayerParameters?: { cql_filter?: string, [key: string]: any }
    rasterSource?: ProcessedRasterSource
    visible: boolean
    queryable?: boolean
    schema?: string
    layerCrs?: string; // CRS of the layer itself (e.g., "EPSG:3857")
    // WFS-specific properties for server-side queries
    wfsUrl?: string
    typeName?: string
}

interface SidebarInsetWithPaginationProps {
    layerContent: LayerContentProps[]
    onSectionChange: (layerTitle: string) => void
    onHighlightChange?: (features: HighlightFeature[]) => void
}

// Single feature card - no wrapper, just the content
const FeatureCard = memo(({
    layer,
    feature,
    buttons,
    handleZoomToFeature,
    bulkRelatedData,
}: {
    layer: LayerContentProps,
    feature: ExtendedFeature,
    buttons: React.ReactNode[] | null,
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, title: string) => void,
    bulkRelatedData?: RelatedDataMap[],
}) => {
    const title = layer.layerTitle || layer.groupLayerTitle;

    return (
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-background/40">
            <PopupButtons
                feature={feature}
                sourceCRS={layer.sourceCRS}
                title={title}
                onZoom={handleZoomToFeature}
                extraButtons={buttons}
            />
            <PopupContentDisplay
                layer={layer}
                feature={feature}
                layout={layer.popupFields &&
                    Object.keys(layer.popupFields).length > 5 ? "grid" : "stacked"}
                bulkRelatedData={bulkRelatedData}
            />
        </div>
    )
});
FeatureCard.displayName = 'FeatureCard';

const PopupContentWithPaginationInner = ({ layerContent, onSectionChange, onHighlightChange }: SidebarInsetWithPaginationProps) => {
    const { map } = useMap()
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

    // Total feature count across all layers
    const totalFeatures = useMemo(
        () => layerContent.reduce((sum, layer) => sum + (layer.features?.length || 0), 0),
        [layerContent]
    )

    // Collect all relatedTables and target values for bulk fetch
    // We group by layer since each layer might have different related tables
    const bulkFetchConfig = useMemo(() => {
        // Find the first layer with relatedTables (they should all share the same config)
        const layerWithRelated = layerContent.find(l => l.relatedTables?.length);
        if (!layerWithRelated?.relatedTables) return { tables: undefined, values: [] };

        // Collect all target values from all features across all layers with these related tables
        const allTargetValues: string[] = [];
        for (const layer of layerContent) {
            if (!layer.relatedTables?.length) continue;
            for (const feature of layer.features) {
                for (const table of layer.relatedTables) {
                    const targetValue = feature.properties?.[table.targetField];
                    if (targetValue) {
                        allTargetValues.push(String(targetValue));
                    }
                }
            }
        }

        return {
            tables: layerWithRelated.relatedTables,
            values: allTargetValues
        };
    }, [layerContent])

    // Bulk fetch related data for all features at once
    const { dataByTable: bulkRelatedData } = useBulkRelatedTable(
        bulkFetchConfig.tables,
        bulkFetchConfig.values
    )

    // Handle layer change via dropdown
    const handleLayerChange = useCallback((index: number) => {
        setSelectedLayerIndex(index)
        if (index === -1) {
            // "All" selected - highlight first feature of first layer
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
            onSectionChange('All')
        } else {
            const layer = layerContent[index]
            if (layer) {
                const title = layer.layerTitle || layer.groupLayerTitle
                onSectionChange(title)
                // Highlight first feature of selected layer
                if (layer.features.length > 0 && layer.features[0].geometry) {
                    onHighlightChange?.([{
                        id: layer.features[0].id as string | number,
                        geometry: layer.features[0].geometry,
                        properties: layer.features[0].properties || {}
                    }])
                }
            }
        }
    }, [layerContent, onSectionChange, onHighlightChange])

    const handleZoomToFeature = useCallback((feature: ExtendedFeature, sourceCRS: string, _title: string) => {
        if (!map) {
            console.warn('[PopupContent] No map available for zoom');
            return;
        }

        // Highlight feature declaratively
        if (feature.geometry) {
            onHighlightChange?.([{
                id: feature.id as string | number,
                geometry: feature.geometry,
                properties: feature.properties || {}
            }])
        }

        // Zoom to feature
        zoomToFeature(feature, map, sourceCRS)
    }, [map, onHighlightChange])

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
                                    ? `All (${totalFeatures} feature${totalFeatures !== 1 ? 's' : ''})`
                                    : `${layerContent[selectedLayerIndex]?.layerTitle || layerContent[selectedLayerIndex]?.groupLayerTitle} (${layerContent[selectedLayerIndex]?.features?.length || 0} feature${(layerContent[selectedLayerIndex]?.features?.length || 0) !== 1 ? 's' : ''})`
                                }
                            </TooltipContent>
                        </Tooltip>
                        <SelectContent>
                            <SelectItem value="-1">
                                All ({totalFeatures} feature{totalFeatures !== 1 ? 's' : ''})
                            </SelectItem>
                            {layerContent.map((layer, index) => {
                                const title = layer.layerTitle || layer.groupLayerTitle
                                const count = layer.features?.length || 0
                                return (
                                    <SelectItem key={`${title}-${index}`} value={String(index)}>
                                        {title} ({count} feature{count !== 1 ? 's' : ''})
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
                    layerContent.map((layer, layerIdx) => (
                        <div key={`${layer.groupLayerTitle}-${layer.layerTitle}-${layerIdx}`}>
                            {/* Layer header */}
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                                {layer.layerTitle || layer.groupLayerTitle}
                            </div>
                            {/* Features in this layer */}
                            <div className="space-y-2">
                                {layer.features.map((feature, featureIdx) => (
                                    <FeatureCard
                                        key={`${feature.id || featureIdx}`}
                                        layer={layer}
                                        feature={feature}
                                        buttons={buttons}
                                        handleZoomToFeature={handleZoomToFeature}
                                        bulkRelatedData={layer.relatedTables?.length ? bulkRelatedData : undefined}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : selectedLayer ? (
                    // Show features from selected layer only
                    <div className="space-y-2">
                        {selectedLayer.features.map((feature, featureIdx) => (
                            <FeatureCard
                                key={`${feature.id || featureIdx}`}
                                layer={selectedLayer}
                                feature={feature}
                                buttons={buttons}
                                handleZoomToFeature={handleZoomToFeature}
                                bulkRelatedData={selectedLayer.relatedTables?.length ? bulkRelatedData : undefined}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

const PopupContentWithPagination = memo(PopupContentWithPaginationInner);
PopupContentWithPagination.displayName = 'PopupContentWithPagination';

export { PopupContentWithPagination };