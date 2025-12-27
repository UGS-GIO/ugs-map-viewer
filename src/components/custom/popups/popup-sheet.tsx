import * as React from "react";
import { useCallback, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { LayerContentProps, PopupContentWithPagination } from "@/components/custom/popups/popup-content-with-pagination";
import { XIcon } from "lucide-react";
import type { HighlightFeature } from "@/components/maps/types";

interface PopupSheetProps {
    popupContent: LayerContentProps[];
    sheetTriggerRef: React.RefObject<HTMLButtonElement>;
    popupTitle: string;
    onClose?: () => void;
    onOpenChange?: (open: boolean) => void;
    /** Callback when highlighted features change (declarative highlighting) */
    onHighlightChange?: (features: HighlightFeature[]) => void;
    /** Current width in pixels (controlled by parent) */
    width?: number;
    /** Callback when width changes via resize handle */
    onWidthChange?: (width: number) => void;
}

export interface PopupSheetRef {
    close: () => void;
    open: () => void;
}

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 480;

const PopupSheet = forwardRef<PopupSheetRef, PopupSheetProps>(({
    popupContent,
    sheetTriggerRef,
    popupTitle,
    onClose,
    onOpenChange,
    onHighlightChange,
    width = DEFAULT_WIDTH,
    onWidthChange,
}, ref) => {
    const carouselRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floatingCloseRef = useRef<HTMLDivElement>(null);
    const [selectedLayerTitle, setSelectedLayerTitle] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const lastScrollTop = useRef(0);

    // Helper to update open state and notify parent
    const updateOpen = useCallback((isOpen: boolean) => {
        setOpen(isOpen);
        onOpenChange?.(isOpen);
    }, [onOpenChange]);

    // Expose close/open methods via ref
    useImperativeHandle(ref, () => ({
        close: () => updateOpen(false),
        open: () => updateOpen(true),
    }), [updateOpen]);

    // Group layers and extract titles
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

    // Derive active layer: use selection if valid, otherwise first layer
    const activeLayerTitle = selectedLayerTitle && layerTitles.includes(selectedLayerTitle)
        ? selectedLayerTitle
        : layerTitles[0] ?? '';

    const contentKey = useMemo(() => {
        return popupContent
            .map(item => `${item.groupLayerTitle}-${item.layerTitle}`)
            .join('|');
    }, [popupContent]);

    const handleCarouselClick = useCallback((title: string) => {
        const element = document.getElementById(`section-${title}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            setSelectedLayerTitle(title);
        }
    }, []);

    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
    }, []);

    const onSectionChange = useCallback((layerTitle: string) => {
        setSelectedLayerTitle(layerTitle);
        const escapedLayerTitle = CSS.escape(`layer-${layerTitle}`);
        const carouselItem = document.getElementById(escapedLayerTitle);
        if (carouselItem) {
            carouselItem.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
    }, []);

    const handleClose = useCallback(() => {
        // Clear highlights declaratively
        onHighlightChange?.([]);
        onClose?.();
    }, [onHighlightChange, onClose]);

    const handleCloseClick = useCallback(() => {
        handleClose();
        updateOpen(false);
    }, [handleClose, updateOpen]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        const isScrollingUp = scrollTop < lastScrollTop.current;
        const isAtTop = scrollTop < 10;
        const shouldShow = isScrollingUp || isAtTop;
        // Single data attribute controls visibility via CSS
        if (floatingCloseRef.current) {
            floatingCloseRef.current.dataset.visible = String(shouldShow);
        }
        lastScrollTop.current = scrollTop;
    }, []);

    // Resize handle mouse down handler
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        if (!onWidthChange) return;
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;

        const onMouseMove = (moveEvent: MouseEvent) => {
            // Dragging left increases width (since sheet is on right side)
            const deltaX = startX - moveEvent.clientX;
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + deltaX));
            onWidthChange(newWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [width, onWidthChange]);

    return (
        <Sheet
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    handleClose();
                }
                updateOpen(isOpen);
            }}
            modal={false}
        >
            <SheetTrigger asChild>
                <Button
                    ref={sheetTriggerRef}
                    size="sm"
                    className="hidden"
                    data-state={open ? 'open' : 'closed'}
                >
                    Open Sheet
                </Button>
            </SheetTrigger>

            <div
                className={cn(
                    "relative h-full w-full overflow-hidden p-0 flex flex-col",
                    "bg-background",
                    !open && "invisible"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Resize handle */}
                {onWidthChange && (
                    <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group"
                        onMouseDown={handleResizeMouseDown}
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-border group-hover:bg-primary group-hover:w-0.5 transition-all" />
                    </div>
                )}

                <SheetHeader className="flex flex-row justify-between items-center py-2 px-3 relative border-b border-border/30 bg-background/40 backdrop-blur-sm">
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

                <div className="grid grid-rows-[auto_1fr] flex-1 min-h-0 overflow-hidden">
                    {layerTitles.length > 1 && (
                        <header className="tall:flex hidden border-b border-border/50 overflow-hidden h-12 px-3 bg-background/40 backdrop-blur-sm">
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
                                                            { 'underline text-primary': activeLayerTitle === groupTitle }
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
                                                                { 'underline text-primary': activeLayerTitle === layerTitle }
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

                    <div className="flex overflow-hidden">
                        <div
                            ref={setContainerRef}
                            onScroll={handleScroll}
                            className="flex flex-1 flex-col gap-4 overflow-y-auto select-text bg-background/20 rounded-t-lg p-3"
                        >
                            <PopupContentWithPagination
                                key={contentKey}
                                layerContent={popupContent}
                                onSectionChange={onSectionChange}
                                onHighlightChange={onHighlightChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Floating close button - visibility controlled by data-visible attribute */}
                <div
                    ref={floatingCloseRef}
                    data-visible="true"
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 ease-in-out data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0 data-[visible=false]:opacity-0 data-[visible=false]:translate-y-4 data-[visible=false]:pointer-events-none"
                >
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

PopupSheet.displayName = 'PopupSheet';

export { PopupSheet };
