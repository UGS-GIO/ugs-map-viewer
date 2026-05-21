import * as React from "react";
import { useCallback, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { LayerContentProps } from "@/components/maps/popups/types";
import { PopupContentWithPagination } from "@/components/maps/popups/popup-content-with-pagination";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import type { HighlightFeature } from "@/components/maps/types";
import { encodeSelection, type SelectionRef } from "@/routes/-summary/-utils/selection-url";

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
    /** Controlled open state from parent */
    isOpen?: boolean;
    /** Click point (WGS84) — used by raster popup cards to snap to COG pixel grid for zoom-to. */
    clickPoint?: { lng: number; lat: number } | null;
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
    isOpen: controlledOpen,
    clickPoint,
}, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const floatingCloseRef = useRef<HTMLDivElement>(null);
    // Use controlled open state if provided, otherwise internal state
    const [internalOpen, setInternalOpen] = useState(controlledOpen ?? false);
    const open = controlledOpen ?? internalOpen;
    const lastScrollTop = useRef(0);

    // Helper to update open state and notify parent
    const updateOpen = useCallback((isOpen: boolean) => {
        setInternalOpen(isOpen);
        onOpenChange?.(isOpen);
    }, [onOpenChange]);

    // Expose close/open methods via ref
    useImperativeHandle(ref, () => ({
        close: () => updateOpen(false),
        open: () => updateOpen(true),
    }), [updateOpen]);

    const contentKey = useMemo(() => {
        return popupContent
            .map(item => `${item.groupLayerTitle}-${item.layerTitle}`)
            .join('|');
    }, [popupContent]);

    const setContainerRef = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
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

                <SheetHeader className="flex flex-row justify-between items-center gap-1 py-2 px-3 relative border-b border-border bg-card">
                    <SheetTitle className="flex-1 truncate">{popupTitle}</SheetTitle>
                    <ExpandToSummaryLink popupContent={popupContent} />
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

                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="flex h-full overflow-hidden">
                        <div
                            ref={setContainerRef}
                            onScroll={handleScroll}
                            className="flex flex-1 flex-col gap-4 overflow-y-auto select-text bg-muted/30 p-3"
                        >
                            <PopupContentWithPagination
                                key={contentKey}
                                layerContent={popupContent}
                                onHighlightChange={onHighlightChange}
                                clickPoint={clickPoint}
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

// Surface a "Expand to summary" affordance whenever the popup carries at
// least one identifiable feature. Selection refs are derived directly from
// popupContent so every route inherits this for free — no per-route wiring.
// We stash the full popupContent in sessionStorage so the summary page can
// render rich content (fields, related tables, raster cards, photos) without
// re-fetching by id; the URL keeps the minimal `features` param so the page
// is still shareable / reloadable in a degraded read-only form.
function ExpandToSummaryLink({ popupContent }: { popupContent: LayerContentProps[] }) {
    const refs = useMemo<SelectionRef[]>(() => {
        const out: SelectionRef[] = []
        for (const layer of popupContent) {
            for (const f of layer.features) {
                const id = (f.properties as Record<string, unknown> | null | undefined)?.ogc_fid
                    ?? f.id
                if (id === null || id === undefined) continue
                out.push({ layerTitle: layer.layerTitle, featureId: String(id) })
            }
        }
        return out
    }, [popupContent])

    const handleClick = useCallback(() => {
        try {
            sessionStorage.setItem('summary:popup-content', JSON.stringify(popupContent))
        } catch (err) {
            console.warn('summary: failed to stash popup content', err)
        }
    }, [popupContent])

    if (refs.length === 0) return null

    // Avoid Button asChild + Link — Radix Slot's "single child" invariant
    // intermittently misreads multi-child Link content. Style the Link directly
    // to look like a ghost-button instead.
    return (
        <Link
            to="/summary"
            search={{ features: encodeSelection(refs) }}
            onClick={handleClick}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            <span>Expand</span>
        </Link>
    )
}

export { PopupSheet };
