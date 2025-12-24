import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useMapCoordinates } from "@/hooks/use-map-coordinates";
import { useMapInteractions } from "@/hooks/use-map-interactions";
import { LayerOrderConfig, useGetLayerConfigsData } from "@/hooks/use-get-layer-configs";
import { useFeatureInfoQuery } from "@/hooks/use-feature-info-query";
import { useLayerUrl } from '@/context/layer-url-provider';
import { useMap } from '@/hooks/use-map';
import { useLayerVisibility } from '@/hooks/use-layer-visibility';
import { useMapClickHandler } from '@/hooks/use-map-click-handler';
import { useFeatureResponseHandler } from '@/hooks/use-feature-response-handler';
import { useMapUrlSync } from '@/hooks/use-map-url-sync';
import { createCoordinateAdapter } from '@/lib/map/coordinates/factory';
import type { CoordinateAdapter } from '@/lib/map/coordinates/types';
import { clearGraphics, highlightFeature } from '@/lib/map/highlight-utils';
import { useMultiSelectTool } from '@/hooks/use-multi-select';
import { useMultiSelect } from '@/context/multi-select-context';
import { useMultiSelectControl } from '@/hooks/use-multi-select-control';
import { AdditiveSelectControl } from '@/lib/map/controls/additive-select-control';
import type { LayerProps } from '@/lib/types/mapping-types';
import type { PopupDrawerRef } from '@/components/custom/popups/popup-drawer';
import { buildVisibleLayersMap, type VisibleLayersMap } from '@/lib/map/layer-info-utils';
import type { MapMouseEvent } from 'maplibre-gl';

interface GeolocateEvent {
    coords: { longitude: number; latitude: number };
}

interface UseMapContainerProps {
    wmsUrl: string;
    layerOrderConfigs?: LayerOrderConfig[];
    layersConfig: ReturnType<typeof useGetLayerConfigsData>;
    popupDrawerRef?: React.RefObject<PopupDrawerRef>;
}

/**
 * Main map container hook that orchestrates all map-related functionality.
 * Coordinates layer visibility, click handling, feature queries, and URL synchronization.
 *
 * Attaches MapLibre click handlers to query features and display popups when users
 * click on map features.
 *
 * @param wmsUrl - Base URL for WMS feature info queries
 * @param layerOrderConfigs - Optional configuration for reordering layers in popups
 * @returns Map container state and event handlers
 */
export function useMapContainer({
    wmsUrl,
    layerOrderConfigs = [],
    layersConfig,
    popupDrawerRef
}: UseMapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const { loadMap, map, isSketching, getIsSketching, shouldIgnoreNextClick, consumeIgnoreClick } = useMap();
    const { coordinates, setCoordinates } = useMapCoordinates();
    const { handleOnContextMenu } = useMapInteractions();
    const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
    const contextMenuTriggerRef = useRef<HTMLDivElement>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement>(null);
    const { selectedLayerTitles } = useLayerUrl();

    // Track shift key and additive mode toggle for multi-select
    const [isShiftHeld, setIsShiftHeld] = useState(false);
    const [additiveModeLocked, setAdditiveModeLocked] = useState(false);

    // Additive mode is active when shift is held OR toggle is locked
    const isAdditiveMode = isShiftHeld || additiveModeLocked;

    // Create coordinate adapter for MapLibre
    const coordinateAdapter: CoordinateAdapter = useMemo(() => {
        return createCoordinateAdapter();
    }, []);

    // Track previous visibility state to prevent unnecessary syncs
    const prevVisibilityRef = useRef<string>('');

    // Helper to extract visibility key from layers - builds string directly to avoid JSON.stringify overhead
    const getVisibilityKey = useCallback((layers: LayerProps[]): string => {
        const parts: string[] = [];
        const extractVisibility = (layerList: LayerProps[]) => {
            for (const layer of layerList) {
                if (layer.title) {
                    parts.push(`${layer.title}:${layer.visible ?? true ? '1' : '0'}`);
                }
                if (layer.type === 'group' && 'layers' in layer && layer.layers) {
                    extractVisibility(layer.layers);
                }
            }
        };
        extractVisibility(layers);
        return parts.join(',');
    }, []);

    // Extract URL synchronization
    const { center, zoom, popupCoords, setPopupCoords } = useMapUrlSync();

    // Process layers based on visibility state
    const processedLayers = useLayerVisibility(
        layersConfig || [],
        selectedLayerTitles
    );

    // Derive visibleLayersMap from processedLayers - no state needed
    // This automatically updates when layer visibility changes
    const visibleLayersMap: VisibleLayersMap = useMemo(
        () => buildVisibleLayersMap(processedLayers),
        [processedLayers]
    );

    // Feature info query handling with coordinate adapter
    // Pass popup coords from URL to enable query on page load
    const featureInfoQuery = useFeatureInfoQuery({
        map,
        wmsUrl,
        visibleLayersMap,
        layerOrderConfigs,
        coordinateAdapter,
        initialPopupCoords: popupCoords
    });

    // Handle side effects of feature query responses
    useFeatureResponseHandler({
        isSuccess: featureInfoQuery.isSuccess,
        featureData: featureInfoQuery.data || [],
        drawerTriggerRef,
        clickId: featureInfoQuery.clickId,
        popupDrawerRef
    });

    // Multi-select tool integration
    const {
        isMultiSelectMode,
        setMultiSelectMode,
        selectionMode,
        addSelectedFeature,
        clearSelectedFeatures,
        isFeatureSelected,
        removeSelectedFeature,
        suppressNextPopup
    } = useMultiSelect();

    // Add multi-select control to map
    useMultiSelectControl(map);

    // Track shift key state for cursor feedback
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftHeld(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftHeld(false);
        };
        const handleBlur = () => setIsShiftHeld(false);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Change cursor when additive mode is active (shift held OR toggle locked)
    useEffect(() => {
        if (!map) return;
        const canvas = map.getCanvas();
        if (isAdditiveMode) {
            canvas.style.cursor = 'copy';
        } else {
            canvas.style.cursor = '';
        }
    }, [map, isAdditiveMode]);

    // Add additive select control to map
    useEffect(() => {
        if (!map) return;

        const control = new AdditiveSelectControl({
            onToggle: (enabled: boolean) => setAdditiveModeLocked(enabled)
        });

        map.addControl(control, 'top-left');

        return () => {
            map.removeControl(control);
        };
    }, [map]);

    const { clearSelection } = useMultiSelectTool({
        map,
        onPolygonComplete: (geometry) => {
            // visibleLayersMap is already derived from processedLayers - just query
            featureInfoQuery.fetchForPolygon(geometry.rings);
        }
    });

    // Handle map clicks with coordinate adapter
    // Use getIsSketching function for synchronous state check if available
    const { handleMapClick } = useMapClickHandler({
        map,
        isSketching: getIsSketching || isSketching,
        shouldIgnoreNextClick,
        consumeIgnoreClick,
        onPointClick: (mapPoint, options) => {
            // Update URL with popup coords (only for non-additive clicks)
            if (!options?.additive) {
                setPopupCoords({ lat: mapPoint.y, lon: mapPoint.x });
            }
            featureInfoQuery.fetchForPoint(mapPoint, options);
        },
        coordinateAdapter,
    });

    // Attach MapLibre click handler to the map instance
    useEffect(() => {
        // Disable clicks when sketching
        if (!map || isSketching) {
            return;
        }

        // In multi-select polygon mode, let terra-draw handle clicks
        if (isMultiSelectMode && selectionMode === 'polygon') {
            return;
        }

        let hasQueriedThisGeolocate = false;

        const handleMapLibreClick = (e: MapMouseEvent) => {
            // Check if additive mode is active (shift key OR toggle locked)
            const isAdditive = (e.originalEvent?.shiftKey ?? false) || additiveModeLocked;

            // Note: Graphics are cleared and re-highlighted by the response handler
            // This ensures accumulated features are properly managed
            featureInfoQuery.hideQueryBbox();

            // Handle click-to-select mode
            // Note: For WMS layers, queryRenderedFeatures returns nothing since WMS is server-rendered.
            // We still attempt it for vector layers, but always fall through to WMS query.
            if (isMultiSelectMode && selectionMode === 'click') {

                // Try to find vector features at click point (works for vector tiles, not WMS)
                const features = map.queryRenderedFeatures(e.point);

                if (features.length > 0) {
                    const clickedFeature = features[0];
                    const featureId = clickedFeature.id;

                    if (featureId !== undefined) {
                        const geoJsonFeature = clickedFeature as unknown as import('geojson').Feature;
                        const layerTitle = clickedFeature.layer?.id || 'Selected Feature';

                        if (isFeatureSelected(featureId)) {
                            // Clicking a selected feature deselects it
                            removeSelectedFeature(featureId);
                            clearGraphics(map, layerTitle);
                            return; // Don't query when deselecting
                        } else if (isAdditive) {
                            // Additive mode adds to selection
                            addSelectedFeature(geoJsonFeature);
                            highlightFeature(geoJsonFeature, map, 'EPSG:4326', layerTitle);
                        } else {
                            // Normal click: clear previous selection, select this feature
                            clearSelectedFeatures();
                            clearGraphics(map);
                            addSelectedFeature(geoJsonFeature);
                            highlightFeature(geoJsonFeature, map, 'EPSG:4326', layerTitle);
                        }
                    }
                }

                // Always query WMS for feature info
                // For additive mode, suppress the popup opening
                if (isAdditive) {
                    suppressNextPopup();
                }
                if (e.point) {
                    handleMapClick({
                        screenX: e.point.x,
                        screenY: e.point.y
                    });
                }
                return;
            }

            // Normal click behavior (selection tool not active)
            if (e.point) {
                // Suppress popup in additive mode (just add to selection)
                if (isAdditive) {
                    suppressNextPopup();
                }
                handleMapClick({
                    screenX: e.point.x,
                    screenY: e.point.y,
                    shiftKey: isAdditive
                });
            }
        };

        const handleUserGeolocate = (e: GeolocateEvent) => {
            // Only query once per geolocate button click (event fires multiple times)
            if (hasQueriedThisGeolocate) {
                return;
            }
            hasQueriedThisGeolocate = true;

            // Query features at user's location
            const { longitude, latitude } = e.coords;
            featureInfoQuery.fetchForPoint({ x: longitude, y: latitude });

            // Reset flag after a delay so button can be clicked again
            setTimeout(() => {
                hasQueriedThisGeolocate = false;
            }, 2000);
        };

        // Use optional chaining to safely add and remove event listener
        map?.on?.('click', handleMapLibreClick);
        map?.on?.('user-geolocate', handleUserGeolocate);
        return () => {
            map?.off?.('click', handleMapLibreClick);
            map?.off?.('user-geolocate', handleUserGeolocate);
        };
    }, [map, isSketching, isMultiSelectMode, selectionMode, handleMapClick, featureInfoQuery, isFeatureSelected, addSelectedFeature, removeSelectedFeature, clearSelectedFeatures, suppressNextPopup, additiveModeLocked]);

    // Initialize the map when the container is ready
    useEffect(() => {
        if (mapRef.current && loadMap && layersConfig) {
            // Check if visibility actually changed before calling loadMap
            const currentVisibility = getVisibilityKey(processedLayers);
            if (map && currentVisibility === prevVisibilityRef.current) {
                // Map exists and visibility hasn't changed - skip
                return;
            }
            prevVisibilityRef.current = currentVisibility;

            loadMap({
                container: mapRef.current,
                zoom,
                center,
                layers: processedLayers,
            });
        }
    }, [loadMap, zoom, center, layersConfig, processedLayers, map, getVisibilityKey]);

    // Handler for when the popup/drawer is closed
    const handleDrawerClose = () => {
        // Clear feature highlight graphics from the map
        if (map) {
            clearGraphics(map);
        }

        // Clear the Terra Draw polygons
        clearSelection();

        // Hide the query bbox visualization
        featureInfoQuery.hideQueryBbox();

        // Clear accumulated query results (important for shift+click multi-select)
        featureInfoQuery.clearAccumulatedData();

        // Clear popup coords from URL
        setPopupCoords(null);

        // If the popup was opened from a polygon query, turn off multi-select mode
        if (featureInfoQuery.isPolygonQuery) {
            setMultiSelectMode(false);
        }
    };

    return {
        mapRef,
        contextMenuTriggerRef,
        drawerTriggerRef,
        popupContainer,
        setPopupContainer,
        popupContent: featureInfoQuery.data || [],
        handleOnContextMenu,
        coordinates,
        setCoordinates,
        layersConfig: processedLayers,
        onDrawerClose: handleDrawerClose,
        isQueryLoading: featureInfoQuery.isFetching,
    };
}