import * as React from "react";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { LayerContentProps, PopupContentWithPagination } from "@/components/custom/popups/popup-content-with-pagination";
import useScreenSize from "@/hooks/use-screen-size";
import { XIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearGraphics } from "@/lib/map/highlight-utils";
import { useMap } from "@/hooks/use-map";

interface CombinedSidebarDrawerProps {
    container: HTMLDivElement | null;
    popupContent: LayerContentProps[];
    drawerTriggerRef: React.RefObject<HTMLButtonElement>;
    popupTitle: string;
}

function PopupDrawer({
    container,
    popupContent,
    drawerTriggerRef,
    popupTitle,
}: CombinedSidebarDrawerProps) {
    const carouselRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [activeLayerTitle, setActiveLayerTitle] = useState<string>("");
    const screenSize = useScreenSize();
    const isMobile = useIsMobile();
    const { view, map } = useMap();

    // Group layers and extract titles - NO side effects
    const { groupedLayers, layerTitles } = useMemo(() => {
        const layers = popupContent
            .map((item) => item.layerTitle || item.groupLayerTitle)
            .filter(title => title !== '');

        const grouped = popupContent.reduce((acc, item) => {
            const { groupLayerTitle, layerTitle } = item;
            if (!acc[groupLayerTitle]) acc[groupLayerTitle] = [];
            if (layerTitle) acc[groupLayerTitle].push(layerTitle);
            return acc;
        }, {} as Record<string, string[]>);

        return { groupedLayers: grouped, layerTitles: layers };
    }, [popupContent]);

    // Initialize active layer separately - runs once per popupContent change
    useEffect(() => {
        if (layerTitles.length > 0) {
            setActiveLayerTitle(layerTitles[0]);
        }
    }, [layerTitles]);

    // Create a stable key based on actual content
    const contentKey = useMemo(() => {
        return popupContent
            .map(item => `${item.groupLayerTitle}-${item.layerTitle}`)
            .join('|');
    }, [popupContent]);

    const handleCarouselClick = useCallback((title: string) => {
        const element = document.getElementById(`section-${title}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveLayerTitle(title);
        }
    }, []);

    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
    }, []);

    const onSectionChange = useCallback((layerTitle: string) => {
        setActiveLayerTitle(layerTitle);

        // Escape layerTitle for querySelector using CSS.escape
        const escapedLayerTitle = CSS.escape(`layer-${layerTitle}`);
        const carouselItem = document.getElementById(escapedLayerTitle);

        if (carouselItem) {
            carouselItem.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
    }, []);

    const handleClose = useCallback(() => {
        const mapOrView = view || map;
        if (mapOrView) {
            try {
                clearGraphics(mapOrView);
            } catch (error) {
                console.error('Error clearing highlights:', error);
            }
        }
    }, [view, map]);

    return (
        <Drawer
            container={container}
            modal={false}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
        >
            <DrawerTrigger asChild>
                <Button ref={drawerTriggerRef} size="sm" className="hidden">
                    Open Drawer
                </Button>
            </DrawerTrigger>

            <DrawerContent className="z-60 max-h-[50vh] md:max-h-[85vh] overflow-hidden md:absolute md:right-4 md:max-w-[30vw] md:mb-10 left-auto w-full">
                <DrawerHeader className="flex justify-between items-center py-2 md:py-4 relative">
                    <DrawerTitle className="flex-1 pr-10">{popupTitle}</DrawerTitle>
                    {!isMobile && (
                        <DrawerClose asChild>
                            <Button
                                variant="outline"
                                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center p-0"
                            >
                                <XIcon className="w-4 h-4" />
                            </Button>
                        </DrawerClose>
                    )}
                </DrawerHeader>

                <DrawerDescription className="sr-only">
                    Popup content for {popupTitle}
                </DrawerDescription>

                <div className="grid grid-rows-[auto_1fr] h-full overflow-hidden mb-6">
                    {screenSize.height > 1080 && layerTitles.length > 1 && (
                        <header className="border-b overflow-hidden h-12">
                            <Carousel className="w-full h-full relative px-8">
                                <CarouselContent className="-ml-2 px-4" ref={carouselRef}>
                                    {Object.entries(groupedLayers).map(([groupTitle, layerTitles], groupIdx) => (
                                        <React.Fragment key={`group-${groupIdx}`}>
                                            {layerTitles.length === 0 ? (
                                                <CarouselItem
                                                    key={`group-${groupIdx}`}
                                                    className="pl-2 basis-auto"
                                                    id={`layer-${groupTitle}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "px-3 py-2 text-sm font-bold transition-all text-secondary-foreground",
                                                            {
                                                                'underline text-primary': activeLayerTitle === groupTitle,
                                                            }
                                                        )}
                                                        onClick={() => handleCarouselClick(groupTitle)}
                                                    >
                                                        {groupTitle}
                                                    </button>
                                                </CarouselItem>
                                            ) : (
                                                layerTitles.map((layerTitle, layerIdx) => (
                                                    <CarouselItem
                                                        key={`layer-${layerIdx}`}
                                                        className="pl-2 basis-auto"
                                                        id={`layer-${layerTitle}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                "px-3 py-2 text-sm font-bold transition-all text-secondary-foreground",
                                                                {
                                                                    'underline text-primary': activeLayerTitle === layerTitle,
                                                                }
                                                            )}
                                                            onClick={() => handleCarouselClick(layerTitle)}
                                                        >
                                                            {layerTitle}
                                                        </button>
                                                    </CarouselItem>
                                                ))
                                            )}
                                        </React.Fragment>
                                    ))}
                                </CarouselContent>
                                <CarouselPrevious className="absolute left-1 top-1/2 -translate-y-1/2" />
                                <CarouselNext className="absolute right-1 top-1/2 -translate-y-1/2" />
                            </Carousel>
                        </header>
                    )}

                    <div className="flex overflow-hidden pt-2">
                        <div
                            ref={setContainerRef}
                            className="flex flex-1 flex-col gap-4 p-1 overflow-y-auto select-text"
                        >
                            <PopupContentWithPagination
                                key={contentKey}
                                layerContent={popupContent}
                                onSectionChange={onSectionChange}
                            />
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

export { PopupDrawer };