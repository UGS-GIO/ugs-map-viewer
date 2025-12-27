import { useEffect, useMemo, useState, memo, useCallback, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Feature, Geometry, GeoJsonProperties } from "geojson"
import { Button } from "@/components/ui/button"
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Shrink } from "lucide-react"
import { PopupContentDisplay } from "@/components/custom/popups/popup-content-display"
import { ColorCodingRecordFunction, FieldConfig, LinkFields, ProcessedRasterSource, RelatedTable } from "@/lib/types/mapping-types"
import { useMap } from "@/hooks/use-map"
import { useGetPopupButtons } from "@/hooks/use-get-popup-buttons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { zoomToFeature } from "@/lib/map/utils"
import type { HighlightFeature } from "@/components/maps/types"

const ITEMS_PER_PAGE_OPTIONS = [1, 5, 10, 25, 50]

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

interface PopupPaginationProps {
    currentPage: number
    totalPages: number
    handlePageChange: (page: number) => void
    itemsPerPage: number
    onItemsPerPageChange: (size: number) => void
}

const PopupPagination = ({ currentPage, totalPages, handlePageChange, itemsPerPage, onItemsPerPageChange }: PopupPaginationProps) => {
    const handleValueChange = (value: string) => {
        onItemsPerPageChange(Number(value))
        handlePageChange(1) // Reset to first page
    }
    return (
        <div className="flex items-center justify-between w-full">
            <div className="flex-1 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
                <Select
                    value={`${itemsPerPage}`}
                    onValueChange={(value) => handleValueChange(value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder={itemsPerPage.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={`${option}`}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="h-8 w-8 p-0">
                    <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                    <ChevronLast className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

const LayerCardInner = ({
    layer,
    buttons,
    handleZoomToFeature,
    onHighlightChange
}: {
    layer: LayerContentProps,
    buttons: React.ReactNode[] | null,
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, title: string) => void,
    onHighlightChange?: (features: HighlightFeature[]) => void
}) => {
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0])
    const [currentPage, setCurrentPage] = useState(1)
    const title = layer.layerTitle || layer.groupLayerTitle;

    // Calculate total pages based on items per page
    const totalPages = useMemo(() =>
        Math.ceil(layer.features.length / itemsPerPage),
        [layer.features, itemsPerPage]
    )

    // Paginate features for this layer
    const paginatedFeatures = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage

        return layer.features.slice(startIndex, startIndex + itemsPerPage)
    }, [layer.features, currentPage, itemsPerPage])

    const handlePageChange = (page: number) => {
        // Calculate the new paginatedFeatures based on the new page
        const startIndex = (page - 1) * itemsPerPage
        const newPaginatedFeatures = layer.features.slice(startIndex, startIndex + itemsPerPage)

        // Set the new page
        setCurrentPage(page)

        // Only highlight to the first feature if items per page is 1
        if (itemsPerPage === 1 && newPaginatedFeatures.length > 0 && newPaginatedFeatures[0].geometry) {
            onHighlightChange?.([{
                id: newPaginatedFeatures[0].id as string | number,
                geometry: newPaginatedFeatures[0].geometry,
                properties: newPaginatedFeatures[0].properties || {}
            }])
        }
    }

    return (
        <Card
            id={`section-${layer.layerTitle !== '' ? layer.layerTitle : layer.groupLayerTitle}`}
            className="w-full bg-background/40 backdrop-blur-sm border-border/50"
        >
            <CardHeader className="p-4">
                <CardTitle>
                    {layer.groupLayerTitle}
                    {layer.layerTitle && layer.layerTitle !== layer.groupLayerTitle && ` - ${layer.layerTitle}`}
                </CardTitle>
                {layer.features.length > ITEMS_PER_PAGE_OPTIONS[0] && (
                    <PopupPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        handlePageChange={handlePageChange}
                        itemsPerPage={itemsPerPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                )}
            </CardHeader>
            <CardContent className="space-y-2 p-2 text-sm">
                {paginatedFeatures.map((feature, idx) => (
                    <div
                        key={idx}
                        className="space-y-2 p-3 rounded-lg border border-border/30"
                    >
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
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

const LayerCard = memo(LayerCardInner);
LayerCard.displayName = 'LayerCard';

const PopupContentWithPaginationInner = ({ layerContent, onSectionChange, onHighlightChange }: SidebarInsetWithPaginationProps) => {
    const { map } = useMap()
    const buttons = useGetPopupButtons()

    // Use ref for callback to avoid recreating observer when callback changes
    const onSectionChangeRef = useRef(onSectionChange);
    onSectionChangeRef.current = onSectionChange;

    const sectionIds = useMemo(
        () => layerContent.map(layer => `section-${layer.layerTitle !== '' ? layer.layerTitle : layer.groupLayerTitle}`),
        [layerContent]
    )

    // Auto-highlight first feature of first layer when popup opens (declarative)
    useEffect(() => {
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
    }, [layerContent.length > 0 ? layerContent[0].groupLayerTitle + layerContent[0].layerTitle : null, onHighlightChange])

    // IntersectionObserver for tracking visible sections - only recreate when sectionIds change
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSections = entries.filter(entry => entry.isIntersecting)

                if (visibleSections.length > 0) {
                    const topmostSection = visibleSections.reduce((prev, current) => {
                        return (prev.boundingClientRect.top < current.boundingClientRect.top) ? prev : current;
                    });

                    const sectionTitle = topmostSection.target.id.replace('section-', '');
                    onSectionChangeRef.current(sectionTitle);
                }
            },
            {
                root: null,
                rootMargin: '0px 0px -50% 0px',
                threshold: 0
            }
        )

        sectionIds.forEach((id) => {
            const element = document.getElementById(id)
            if (element) {
                observer.observe(element)
            }
        })

        return () => observer.disconnect()
    }, [sectionIds])
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

    // Generate stable key from layer content - only changes when layers actually change
    const contentKey = useMemo(() =>
        layerContent.map(l => `${l.groupLayerTitle}|${l.layerTitle}|${l.features.length}`).join(','),
        [layerContent]
    )

    // If no layers, return null
    if (layerContent.length === 0) return null;

    return (
        <div className="flex flex-col gap-4 select-text">
            {layerContent.map((layer) => (
                <LayerCard
                    key={`${contentKey}-${layer.groupLayerTitle}-${layer.layerTitle}`}
                    layer={layer}
                    buttons={buttons}
                    handleZoomToFeature={handleZoomToFeature}
                    onHighlightChange={onHighlightChange}
                />
            ))}
        </div>
    )
}

const PopupContentWithPagination = memo(PopupContentWithPaginationInner);
PopupContentWithPagination.displayName = 'PopupContentWithPagination';

export { PopupContentWithPagination };