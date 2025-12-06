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
import { clearGraphics } from '@/lib/map/highlight-utils';
import { useMultiSelectTool } from '@/hooks/use-multi-select';
import { useMultiSelect } from '@/context/multi-select-context';
import { useMultiSelectControl } from '@/hooks/use-multi-select-control';
import type { LayerProps } from '@/lib/types/mapping-types';
import type { PopupDrawerRef } from '@/components/custom/popups/popup-drawer';
import { buildVisibleLayersMap } from '@/lib/map/layer-info-utils';

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
    const [visibleLayersMap, setVisibleLayersMap] = useState({});
    const { selectedLayerTitles } = useLayerUrl();

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

    // Build visibleLayersMap on initial load when popup coords are in URL
    // This ensures the feature query can run before user clicks
    // Use processedLayers (not layersConfig) to get correct visibility from URL params
    useEffect(() => {
        // Wait for selectedLayerTitles to be populated (URL normalization may take a render cycle)
        if (!map || processedLayers.length === 0 || !popupCoords || selectedLayerTitles.size === 0) return;

        // Only run once when map becomes ready with popup coords
        if (Object.keys(visibleLayersMap).length > 0) return;

        // Use shared utility - pass null for map to use config visibility (faster initial load)
        const newVisibleLayersMap = buildVisibleLayersMap(processedLayers, null);
        if (Object.keys(newVisibleLayersMap).length > 0) {
            setVisibleLayersMap(newVisibleLayersMap);
        }
    }, [map, processedLayers, popupCoords, visibleLayersMap, selectedLayerTitles]);

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
        isPolygonQuery: featureInfoQuery.isPolygonQuery,
        popupDrawerRef
    });

    // Multi-select tool integration
    const { isMultiSelectMode, setMultiSelectMode } = useMultiSelect();

    // Add multi-select control to map
    useMultiSelectControl(map);

    const { clearSelection } = useMultiSelectTool({
        map,
        onPolygonComplete: (geometry) => {
            // Build visibleLayersMap before querying - pass map to check actual visibility
            if (layersConfig && Array.isArray(layersConfig)) {
                const newVisibleLayersMap = buildVisibleLayersMap(layersConfig, map);
                setVisibleLayersMap(newVisibleLayersMap);
            }

            // Convert GeoJSON rings to WGS84 (they're already in WGS84 from Terra Draw)
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
        onPointClick: (mapPoint) => {
            // Update URL with popup coords
            setPopupCoords({ lat: mapPoint.y, lon: mapPoint.x });
            featureInfoQuery.fetchForPoint(mapPoint);
        },
        setVisibleLayersMap,
        coordinateAdapter,
        layersConfig
    });

    // Attach MapLibre click handler to the map instance
    useEffect(() => {
        // Disable clicks when sketching or in multi-select mode
        if (!map || isSketching || isMultiSelectMode) {
            return;
        }

        let hasQueriedThisGeolocate = false;

        const handleMapLibreClick = (e: any) => {
            // Clear any previous graphics and query bbox immediately
            clearGraphics(map);
            featureInfoQuery.hideQueryBbox();

            // MapLibre's click event provides point with screen coordinates
            if (e.point) {
                handleMapClick({
                    screenX: e.point.x,
                    screenY: e.point.y
                });
            }
        };

        const handleUserGeolocate = (e: any) => {
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
    }, [map, isSketching, isMultiSelectMode, handleMapClick, featureInfoQuery]);

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