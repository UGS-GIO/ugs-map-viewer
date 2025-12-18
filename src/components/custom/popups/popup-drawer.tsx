import * as React from "react";
import { useCallback, useMemo, useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { LayerContentProps, PopupContentWithPagination } from "@/components/custom/popups/popup-content-with-pagination";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearGraphics } from "@/lib/map/highlight-utils";
import { useMap } from "@/hooks/use-map";
import { XIcon } from "lucide-react";

interface CombinedSidebarDrawerProps {
    container?: HTMLDivElement | null;
    popupContent: LayerContentProps[];
    drawerTriggerRef: React.RefObject<HTMLButtonElement>;
    popupTitle: string;
    onClose?: () => void;
}

export interface PopupDrawerRef {
    close: () => void;
    open: () => void;
}

const PopupDrawer = forwardRef<PopupDrawerRef, CombinedSidebarDrawerProps>(({
    popupContent,
    drawerTriggerRef,
    popupTitle,
    onClose,
}, ref) => {
    const carouselRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sheetContentRef = useRef<HTMLDivElement>(null);
    const [activeLayerTitle, setActiveLayerTitle] = useState<string>("");
    const [open, setOpen] = useState(false);
    const [showCloseButton, setShowCloseButton] = useState(true);
    const lastScrollTop = useRef(0);
    const isMobile = useIsMobile();
    const { map } = useMap();

    // Expose close/open methods via ref
    useImperativeHandle(ref, () => ({
        close: () => setOpen(false),
        open: () => setOpen(true),
    }));

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
        if (map) {
            try {
                clearGraphics(map);
            } catch (error) {
                console.error('Error clearing highlights:', error);
            }
        }
        // Call external onClose callback if provided
        onClose?.();
    }, [map, onClose]);

    const handleCloseClick = useCallback(() => {
        // Call handleClose to clear graphics and trigger onClose callback
        handleClose();
        // Set open to false
        setOpen(false);
    }, [handleClose]);

    // Scroll handler for smart reveal close button
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const isScrollingUp = scrollTop < lastScrollTop.current;
        const isAtTop = scrollTop < 10;

        // Show button when scrolling up or at top
        setShowCloseButton(isScrollingUp || isAtTop);
        lastScrollTop.current = scrollTop;
    }, []);

    return (
        <Sheet
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    handleClose();
                } else {
                    setOpen(true);
                }
            }}
            modal={false}
        >
            <SheetTrigger asChild>
                <Button
                    ref={drawerTriggerRef}
                    size="sm"
                    className="hidden"
                    data-state={open ? 'open' : 'closed'}
                >
                    Open Sheet
                </Button>
            </SheetTrigger>

            {/* Render without portal to constrain to parent container */}
            <div
                ref={sheetContentRef}
                className={cn(
                    "absolute right-0 z-10 overflow-hidden p-0 flex flex-col",
                    "bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80",
                    "dark:bg-background/80",
                    // Mobile: full screen takeover
                    isMobile ? "inset-0 border-0 rounded-none" :
                    // Desktop: positioned with border
                    "top-0 bottom-0 w-full sm:max-w-md md:max-w-lg lg:max-w-xl border-l border-border dark:border-border",
                    // Slide animation
                    "transition-transform duration-300 ease-in-out",
                    open ? "translate-x-0" : "translate-x-full",
                    // Hide when closed but keep in DOM for animation
                    !open && "pointer-events-none"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <SheetHeader className="flex flex-row justify-between items-center py-2 px-3 relative border-b border-border/30 bg-background/30 backdrop-blur-sm">
                    <SheetTitle className="flex-1">{popupTitle}</SheetTitle>
                    <Button
                        onClick={handleCloseClick}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Close"
                    >
                        <XIcon className="h-4 w-4" />
                    </Button>
                </SheetHeader>

                <SheetDescription className="sr-only">
                    Popup content for {popupTitle}
                </SheetDescription>

                <div className="grid grid-rows-[auto_1fr] flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-transparent to-background/20">
                    {layerTitles.length > 1 && (
                        <header className="tall:flex hidden border-b border-border/50 overflow-hidden h-12 px-3 bg-background/30 backdrop-blur-sm">
                            <Carousel className="w-full h-full relative px-2">
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

                    <div className="flex overflow-hidden bg-background/20">
                        <div
                            ref={setContainerRef}
                            onScroll={handleScroll}
                            className="flex flex-1 flex-col gap-4 overflow-y-auto select-text bg-background/10 rounded-t-lg p-3"
                        >
                            <PopupContentWithPagination
                                key={contentKey}
                                layerContent={popupContent}
                                onSectionChange={onSectionChange}
                            />
                        </div>
                    </div>

                </div>

                {/* Floating close button - smart reveal on scroll up */}
                <div className={cn(
                    "absolute bottom-8 left-1/2 -translate-x-1/2 z-30",
                    "transition-all duration-200 ease-in-out",
                    showCloseButton
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4 pointer-events-none"
                )}>
                    <Button
                        onClick={handleCloseClick}
                        variant="default"
                        size="lg"
                        className="shadow-lg gap-2"
                    >
                        <XIcon className="h-4 w-4" />
                        Close
                    </Button>
                </div>
            </div>
        </Sheet>
    );
});

PopupDrawer.displayName = 'PopupDrawer';

export { PopupDrawer };