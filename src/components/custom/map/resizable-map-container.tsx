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
import { cn } from '@/lib/utils';

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
    }, [hasResults]);

    // Add/remove ViewModeControl and sync hasResults state
    useEffect(() => {
        if (!map || usePopupMode) return;

        const control = new ViewModeControl({
            initialMode: viewMode,
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
        setViewMode('map');
        viewModeControlRef.current?.setMode('map');
        onDrawerClose();
    }, [onDrawerClose]);

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

                    {/* Popup drawer - only in map-only mode, positioned alongside map */}
                    {viewMode === 'map' && (
                        <div className={cn(
                            "h-full border-l bg-background overflow-hidden transition-[width] duration-200 ease-linear",
                            isDrawerOpen && !isMobile ? "w-[480px]" : "w-0",
                            isDrawerOpen && isMobile && "w-full"
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
                </div>

                {/* Resize handle - only in split mode */}
                {viewMode === 'split' && (
                    <div
                        className="h-2 bg-border hover:bg-accent cursor-row-resize flex items-center justify-center shrink-0"
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
                        />
                    )}
                </div>
            </div>

            <div ref={setPopupContainer} />
        </>
    );
}
