import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContextMenu } from '@/components/custom/map/map-context-menu';
import { MapWrapper } from '@/components/custom/map/map-wrapper';
import { PopupDrawer, PopupDrawerRef } from '@/components/custom/popups/popup-drawer';
import { QueryResultsTable } from '@/components/custom/data-table/query-results-table';
import { useMapContainer } from '@/hooks/use-map-container';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import { useMap } from '@/hooks/use-map';
import { ViewModeControl } from '@/lib/map/controls/view-mode-control';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMapUrlSync, type ViewMode } from '@/hooks/use-map-url-sync';
import { useSidebar } from '@/hooks/use-sidebar';
import { cn } from '@/lib/utils';
import { Map, Table2, Layers, SplitSquareVertical } from 'lucide-react';

interface ResizableMapContainerProps {
    wmsUrl: string;
    layerConfigKey: string;
    popupTitle: string;
    children: React.ReactNode;
    /** Use popup drawer instead of split table (default: false for split mode) */
    usePopupMode?: boolean;
}

export function ResizableMapContainer({
    wmsUrl,
    layerConfigKey,
    popupTitle,
    children,
    usePopupMode = false,
}: ResizableMapContainerProps) {
    const { map } = useMap();
    const isMobile = useIsMobile();
    const { viewMode, setViewMode } = useMapUrlSync();
    const { setNavOpened } = useSidebar();
    const defaultLayersConfig = useGetLayerConfigsData(layerConfigKey);
    const popupDrawerRef = useRef<PopupDrawerRef>(null);
    const [tablePanelSize, setTablePanelSize] = useState(50);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const viewModeControlRef = useRef<ViewModeControl | null>(null);

    const {
        mapRef,
        contextMenuTriggerRef,
        drawerTriggerRef,
        popupContainer,
        setPopupContainer,
        popupContent,
        handleOnContextMenu,
        coordinates,
        setCoordinates,
        onDrawerClose,
        isQueryLoading,
    } = useMapContainer({
        wmsUrl,
        layersConfig: defaultLayersConfig,
        popupDrawerRef: viewMode === 'map' ? popupDrawerRef : undefined,
    });

    const hasResults = popupContent && popupContent.length > 0;

    // Handle view mode changes - re-open drawer when switching to map with results
    const handleViewModeChange = useCallback((mode: ViewMode) => {
        setViewMode(mode);
        if (mode === 'map' && hasResults) {
            // Re-open the popup drawer when switching to map mode with results
            requestAnimationFrame(() => popupDrawerRef.current?.open());
        }
    }, [setViewMode, hasResults]);

    // Capture initial viewMode in a ref so we don't recreate control on every viewMode change
    const initialViewModeRef = useRef(viewMode);

    // Add/remove ViewModeControl and sync hasResults state
    useEffect(() => {
        if (!map || usePopupMode) return;

        const control = new ViewModeControl({
            initialMode: initialViewModeRef.current,
            onModeChange: handleViewModeChange,
        });

        map.addControl(control, 'top-right');
        viewModeControlRef.current = control;
        control.setHasResults(hasResults ?? false);

        return () => {
            if (viewModeControlRef.current) {
                map.removeControl(viewModeControlRef.current);
                viewModeControlRef.current = null;
            }
        };
    }, [map, usePopupMode, hasResults, handleViewModeChange]);

    // Handle map resize after CSS transition ends
    const handleTransitionEnd = useCallback(() => {
        map?.resize();
    }, [map]);

    const handleCloseTable = useCallback(() => {
        // Clear data first, THEN switch mode to prevent drawer from opening with stale data
        onDrawerClose();
        setViewMode('map');
        viewModeControlRef.current?.setMode('map');
    }, [setViewMode, onDrawerClose]);

    const handleDrawerOpenChange = useCallback((open: boolean) => {
        setIsDrawerOpen(open);
        // Trigger initial resize when drawer state changes
        requestAnimationFrame(() => map?.resize());
    }, [map]);

    // If using popup mode, render the original layout
    if (usePopupMode) {
        return (
            <>
                <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />
                <MapWrapper
                    mapRef={mapRef}
                    isLoading={isQueryLoading}
                    onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
                >
                    {children}
                    <PopupDrawer
                        ref={popupDrawerRef}
                        container={popupContainer}
                        drawerTriggerRef={drawerTriggerRef}
                        popupContent={popupContent}
                        popupTitle={popupTitle}
                        onClose={onDrawerClose}
                    />
                </MapWrapper>
                <div ref={setPopupContainer} />
            </>
        );
    }

    // Determine if drawer should affect map width
    const shouldShrinkMap = viewMode === 'map' && isDrawerOpen && !isMobile;

    // Split/Table mode layout - map is ALWAYS in DOM, just resized
    return (
        <>
            <MapContextMenu coordinates={coordinates} hiddenTriggerRef={contextMenuTriggerRef} />

            <div className="relative h-full w-full flex flex-col overflow-hidden">
                {/* Map + Drawer row */}
                <div
                    className="relative flex min-h-0 overflow-hidden"
                    style={{
                        flex: viewMode === 'table' ? '0 0 0%'
                            : viewMode === 'split' ? `1 1 ${100 - tablePanelSize}%`
                            : '1 1 100%'
                    }}
                >
                    {/* Map section - width changes when drawer is open */}
                    <div
                        className={cn(
                            "relative h-full overflow-hidden transition-[width] duration-200 ease-linear",
                            shouldShrinkMap ? "w-[calc(100%-480px)]" : "w-full"
                        )}
                        onTransitionEnd={handleTransitionEnd}
                    >
                        <MapWrapper
                            mapRef={mapRef}
                            isLoading={isQueryLoading}
                            onContextMenu={e => handleOnContextMenu(e, contextMenuTriggerRef, setCoordinates)}
                        >
                            {children}
                        </MapWrapper>
                    </div>

                    {/* Popup drawer - desktop: alongside map, mobile: overlay from bottom */}
                    {viewMode === 'map' && !isMobile && (
                        <div className={cn(
                            "h-full border-l bg-background overflow-hidden transition-[width] duration-200 ease-linear",
                            isDrawerOpen ? "w-[480px]" : "w-0"
                        )}>
                            <PopupDrawer
                                ref={popupDrawerRef}
                                container={popupContainer}
                                drawerTriggerRef={drawerTriggerRef}
                                popupContent={popupContent}
                                popupTitle={popupTitle}
                                onClose={onDrawerClose}
                                onOpenChange={handleDrawerOpenChange}
                            />
                        </div>
                    )}

                    {/* Mobile drawer - overlay from bottom */}
                    {viewMode === 'map' && isMobile && (
                        <div className={cn(
                            "absolute inset-x-0 bottom-0 z-50 bg-background border-t rounded-t-xl shadow-lg",
                            "transition-transform duration-200 ease-linear",
                            isDrawerOpen ? "translate-y-0" : "translate-y-full"
                        )}
                        style={{ height: '70%' }}
                        >
                            <PopupDrawer
                                ref={popupDrawerRef}
                                container={popupContainer}
                                drawerTriggerRef={drawerTriggerRef}
                                popupContent={popupContent}
                                popupTitle={popupTitle}
                                onClose={onDrawerClose}
                                onOpenChange={handleDrawerOpenChange}
                            />
                        </div>
                    )}
                </div>

                {/* Resize handle - only in split mode */}
                {viewMode === 'split' && (
                    <div
                        className="h-3 bg-border hover:bg-accent active:bg-accent cursor-row-resize flex items-center justify-center shrink-0 touch-none"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            const startY = e.clientY;
                            const startSize = tablePanelSize;
                            const container = e.currentTarget.parentElement;
                            if (!container) return;
                            const containerHeight = container.clientHeight;

                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const deltaY = startY - moveEvent.clientY;
                                const deltaPercent = (deltaY / containerHeight) * 100;
                                const newSize = Math.min(80, Math.max(20, startSize + deltaPercent));
                                setTablePanelSize(newSize);
                                map?.resize();
                            };

                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                                map?.resize();
                            };

                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                        onTouchStart={(e) => {
                            const touch = e.touches[0];
                            const startY = touch.clientY;
                            const startSize = tablePanelSize;
                            const container = e.currentTarget.parentElement;
                            if (!container) return;
                            const containerHeight = container.clientHeight;

                            const onTouchMove = (moveEvent: TouchEvent) => {
                                const currentTouch = moveEvent.touches[0];
                                const deltaY = startY - currentTouch.clientY;
                                const deltaPercent = (deltaY / containerHeight) * 100;
                                const newSize = Math.min(80, Math.max(20, startSize + deltaPercent));
                                setTablePanelSize(newSize);
                                map?.resize();
                            };

                            const onTouchEnd = () => {
                                document.removeEventListener('touchmove', onTouchMove);
                                document.removeEventListener('touchend', onTouchEnd);
                                map?.resize();
                            };

                            document.addEventListener('touchmove', onTouchMove, { passive: true });
                            document.addEventListener('touchend', onTouchEnd);
                        }}
                    >
                        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
                    </div>
                )}

                {/* Table section - grows based on view mode */}
                <div
                    className="bg-background border-t overflow-hidden"
                    style={{
                        flex: viewMode === 'map' ? '0 0 0%'
                            : viewMode === 'split' ? `1 1 ${tablePanelSize}%`
                            : '1 1 100%'
                    }}
                >
                    {(viewMode === 'split' || viewMode === 'table') && (
                        <QueryResultsTable
                            layerContent={popupContent}
                            onClose={handleCloseTable}
                            viewMode={viewMode}
                            onViewModeChange={handleViewModeChange}
                        />
                    )}
                </div>

                {/* Mobile bottom navigation bar */}
                {isMobile && (
                    <div className="flex-shrink-0 bg-card border-t border-border px-2 py-2 z-40">
                        <div className="flex justify-around items-center max-w-md mx-auto">
                            <button
                                onClick={() => handleViewModeChange('map')}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                                    viewMode === 'map'
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Map className="w-5 h-5" />
                                <span className="text-xs font-medium">Map</span>
                            </button>
                            <button
                                onClick={() => handleViewModeChange('split')}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                                    viewMode === 'split'
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <SplitSquareVertical className="w-5 h-5" />
                                <span className="text-xs font-medium">Split</span>
                            </button>
                            <button
                                onClick={() => handleViewModeChange('table')}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                                    viewMode === 'table'
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Table2 className="w-5 h-5" />
                                <span className="text-xs font-medium">Table</span>
                            </button>
                            <button
                                onClick={() => setNavOpened(true)}
                                className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <Layers className="w-5 h-5" />
                                <span className="text-xs font-medium">Layers</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div ref={setPopupContainer} />
        </>
    );
}
