import { useEffect, useMemo, useState, memo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Feature, Geometry, GeoJsonProperties } from "geojson"
import { Button } from "@/components/ui/button"
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Shrink } from "lucide-react"
import { PopupContentDisplay } from "@/components/custom/popups/popup-content-display"
import { ColorCodingRecordFunction, FieldConfig, LinkFields, ProcessedRasterSource, RelatedTable } from "@/lib/types/mapping-types"
import { useMap } from "@/hooks/use-map"
import { clearGraphics, highlightFeature } from '@/lib/map/highlight-utils';
import { useGetPopupButtons } from "@/hooks/use-get-popup-buttons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { zoomToFeature } from "@/lib/map/utils"

const ITEMS_PER_PAGE_OPTIONS = [1, 5, 10, 25, 50]
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
}

interface SidebarInsetWithPaginationProps {
    layerContent: LayerContentProps[]
    onSectionChange: (layerTitle: string) => void
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
    handleZoomToFeature
}: {
    layer: LayerContentProps,
    buttons: React.ReactNode[] | null,
    handleZoomToFeature: (feature: ExtendedFeature, sourceCRS: string, title: string) => Promise<void>
}) => {
    const { map } = useMap();
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
        if (itemsPerPage === 1 && newPaginatedFeatures.length > 0) {
            if (!map) return
            clearGraphics(map)
            highlightFeature(newPaginatedFeatures[0], map, layer.sourceCRS, title)
        }
    }

    const PopupButtons = ({ feature }: { feature: ExtendedFeature }) => (
        <div className="flex justify-start gap-2">
            <Button variant="ghost" onClick={() => handleZoomToFeature(feature, layer.sourceCRS, title)} className="flex gap-x-2">
                <Shrink className="h-5 w-5" />
                <span className="hidden md:flex">Zoom to Feature</span>
                <span className="md:hidden">Zoom</span>
            </Button>
            {buttons && buttons.map((button) => button)}
        </div>
    )

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
            <CardContent className="space-y-4 p-2">
                {paginatedFeatures.map((feature, idx) => (
                    <div
                        key={idx}
                        className={`
                                space-y-4
                                p-4
                                rounded-lg
                                bg-background/30
                                backdrop-blur-sm
                                border
                                border-border/30
                            `}
                    >
                        <PopupButtons feature={feature} />

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

const PopupContentWithPaginationInner = ({ layerContent, onSectionChange }: SidebarInsetWithPaginationProps) => {
    const { map } = useMap()
    const buttons = useGetPopupButtons()

    const sectionIds = useMemo(
        () => layerContent.map(layer => `section-${layer.layerTitle !== '' ? layer.layerTitle : layer.groupLayerTitle}`),
        [layerContent]
    )

    // Auto-highlight first feature of first layer when popup opens
    useEffect(() => {
        if (layerContent.length > 0 && layerContent[0].features.length > 0) {
            if (!map) {
                return
            }

            const firstLayer = layerContent[0]
            const firstFeature = firstLayer.features[0]
            const title = firstLayer.layerTitle || firstLayer.groupLayerTitle

            // Clear ALL previous highlights from all layers when showing new popup
            clearGraphics(map)
            highlightFeature(firstFeature, map, firstLayer.sourceCRS, title).catch(error => {
                console.error('[PopupContent] Error highlighting first feature:', error)
            })
        }
    }, [layerContent.length > 0 ? layerContent[0].groupLayerTitle + layerContent[0].layerTitle : null, map])

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSections = entries.filter(entry => entry.isIntersecting)

                if (visibleSections.length > 0) {
                    const topmostSection = visibleSections.reduce((prev, current) => {
                        return (prev.boundingClientRect.top < current.boundingClientRect.top) ? prev : current;
                    });

                    const sectionTitle = topmostSection.target.id.replace('section-', '');
                    onSectionChange(sectionTitle);
                }
            },
            {
                root: null, // Use the viewport as the root
                rootMargin: '0px 0px -50% 0px', // 50% of the section must be visible
                threshold: 0 // Trigger as soon as any part of the section enters the viewport
            }
        )

        sectionIds.forEach((id) => {
            const element = document.getElementById(id)
            if (element) {
                observer.observe(element)
            }
        })

        return () => observer.disconnect()
    }, [sectionIds, onSectionChange])
    const handleZoomToFeature = async (feature: ExtendedFeature, sourceCRS: string, title: string) => {
        if (!map) {
            console.warn('[PopupContent] No map available for zoom');
            return;
        }

        // Clear ALL previous graphics from all layers when zooming to a feature
        try {
            clearGraphics(map)  // Clear all graphics, not just this layer
            await highlightFeature(feature, map, sourceCRS, title)
        } catch (error) {
            console.error('[PopupContent] Error highlighting feature:', error);
        }

        // Zoom to feature
        zoomToFeature(feature, map, sourceCRS)
    }

    const contentKey = useMemo(() => Date.now(), [layerContent])

    // If no layers, return null
    if (layerContent.length === 0) return null;

    return (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto select-text h-full scrollable-container">
            {layerContent.map((layer) => (
                <LayerCard
                    key={`${contentKey}-${layer.groupLayerTitle}-${layer.layerTitle}`}
                    layer={layer}
                    buttons={buttons}
                    handleZoomToFeature={handleZoomToFeature}
                />
            ))}
        </div>
    )
}

const PopupContentWithPagination = memo(PopupContentWithPaginationInner);
PopupContentWithPagination.displayName = 'PopupContentWithPagination';

export { PopupContentWithPagination };