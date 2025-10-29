import { useRef, useState, useEffect, useMemo } from 'react';
import { useMapCoordinates } from "@/hooks/use-map-coordinates";
import { useMapInteractions } from "@/hooks/use-map-interactions";
import { useMapPositionUrlParams } from "@/hooks/use-map-position-url-params";
import { LayerOrderConfig, useGetLayerConfigsData } from "@/hooks/use-get-layer-configs";
import { useMapClickOrDrag } from "@/hooks/use-map-click-or-drag";
import { useFeatureInfoQuery } from "@/hooks/use-feature-info-query";
import { useLayerUrl } from '@/context/layer-url-provider';
import { useMap } from '@/hooks/use-map';
import { useLayerVisibility } from '@/hooks/use-layer-visibility';
import { useMapClickHandler } from '@/hooks/use-map-click-handler';
import { useFeatureResponseHandler } from '@/hooks/use-feature-response-handler';
import { useMapUrlSync } from '@/hooks/use-map-url-sync';
import { createCoordinateAdapter } from '@/lib/map/coordinates/factory';
import type { CoordinateAdapter } from '@/lib/map/coordinates/types';
import { getMapImplementation } from '@/lib/map/get-map-implementation';

interface UseMapContainerProps {
    wmsUrl: string;
    layerOrderConfigs?: LayerOrderConfig[];
    layersConfig: ReturnType<typeof useGetLayerConfigsData>;
}

/**
 * Main map container hook that orchestrates all map-related functionality.
 * Coordinates layer visibility, click handling, feature queries, and URL synchronization.
 * Designed to be gradually migrated from ArcGIS to MapLibre by extracting concerns
 * into separate, testable hooks.
 *
 * Uses the VITE_MAP_IMPL environment variable to determine which map implementation
 * to use (ArcGIS or MapLibre). This enables feature flag-based switching without
 * code changes.
 *
 * @param wmsUrl - Base URL for WMS feature info queries
 * @param layerOrderConfigs - Optional configuration for reordering layers in popups
 * @returns Map container state and event handlers
 */
export function useMapContainer({
    wmsUrl,
    layerOrderConfigs = [],
    layersConfig
}: UseMapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const { loadMap, view, isSketching } = useMap();
    const { coordinates, setCoordinates } = useMapCoordinates();
    const { handleOnContextMenu, getVisibleLayers } = useMapInteractions({ layersConfig: layersConfig });
    const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
    const contextMenuTriggerRef = useRef<HTMLDivElement>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement>(null);
    useMapPositionUrlParams(view);
    const [visibleLayersMap, setVisibleLayersMap] = useState({});
    const { selectedLayerTitles, hiddenGroupTitles } = useLayerUrl();

    // Create coordinate adapter based on active map implementation from feature flag
    const coordinateAdapter: CoordinateAdapter = useMemo(() => {
        const mapImpl = getMapImplementation();
        return createCoordinateAdapter(mapImpl);
    }, []);

    // Extract URL synchronization
    const { center, zoom } = useMapUrlSync();

    // Process layers based on visibility state
    const processedLayers = useLayerVisibility(
        layersConfig || [],
        selectedLayerTitles,
        hiddenGroupTitles
    );

    // Feature info query handling with coordinate adapter
    const featureInfoQuery = useFeatureInfoQuery({
        view,
        wmsUrl,
        visibleLayersMap,
        layerOrderConfigs,
        coordinateAdapter
    });

    // Handle side effects of feature query responses
    useFeatureResponseHandler({
        isSuccess: featureInfoQuery.isSuccess,
        featureData: featureInfoQuery.data || [],
        view,
        drawerTriggerRef,
        clickId: featureInfoQuery.clickId
    });

    // Handle map clicks with coordinate adapter
    const { handleMapClick } = useMapClickHandler({
        view,
        isSketching,
        onPointClick: (mapPoint) => {
            featureInfoQuery.fetchForPoint(mapPoint);
        },
        getVisibleLayers,
        setVisibleLayersMap,
        coordinateAdapter
    });

    // Handle click or drag events on the map
    const { clickOrDragHandlers } = useMapClickOrDrag({
        onClick: (e) => {
            handleMapClick({
                screenX: e.nativeEvent.offsetX,
                screenY: e.nativeEvent.offsetY
            });
        }
    });

    // Initialize the map when the container is ready
    useEffect(() => {
        if (mapRef.current && loadMap && layersConfig) {
            loadMap({
                container: mapRef.current,
                zoom,
                center,
                layers: processedLayers,
            });
        }
    }, [loadMap, zoom, center, layersConfig, processedLayers]);

    return {
        mapRef,
        contextMenuTriggerRef,
        drawerTriggerRef,
        popupContainer,
        setPopupContainer,
        popupContent: featureInfoQuery.data || [],
        clickOrDragHandlers,
        handleOnContextMenu,
        coordinates,
        setCoordinates,
        view,
        layersConfig: processedLayers,
    };
}