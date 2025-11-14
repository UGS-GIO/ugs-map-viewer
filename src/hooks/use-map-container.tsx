import { useRef, useState, useEffect, useMemo } from 'react';
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

interface UseMapContainerProps {
    wmsUrl: string;
    layerOrderConfigs?: LayerOrderConfig[];
    layersConfig: ReturnType<typeof useGetLayerConfigsData>;
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
    layersConfig
}: UseMapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const { loadMap, map, isSketching, getIsSketching, shouldIgnoreNextClick, consumeIgnoreClick } = useMap();
    const { coordinates, setCoordinates } = useMapCoordinates();
    const { handleOnContextMenu } = useMapInteractions();
    const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
    const contextMenuTriggerRef = useRef<HTMLDivElement>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement>(null);
    const [visibleLayersMap, setVisibleLayersMap] = useState({});
    const { selectedLayerTitles, hiddenGroupTitles } = useLayerUrl();

    // Create coordinate adapter for MapLibre
    const coordinateAdapter: CoordinateAdapter = useMemo(() => {
        return createCoordinateAdapter();
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
        map,
        wmsUrl,
        visibleLayersMap,
        layerOrderConfigs,
        coordinateAdapter
    });

    // Handle side effects of feature query responses
    useFeatureResponseHandler({
        isSuccess: featureInfoQuery.isSuccess,
        featureData: featureInfoQuery.data || [],
        drawerTriggerRef,
        clickId: featureInfoQuery.clickId
    });

    // Handle map clicks with coordinate adapter
    // Use getIsSketching function for synchronous state check if available
    const { handleMapClick } = useMapClickHandler({
        map,
        isSketching: getIsSketching || isSketching,
        shouldIgnoreNextClick,
        consumeIgnoreClick,
        onPointClick: (mapPoint) => {
            featureInfoQuery.fetchForPoint(mapPoint);
        },
        setVisibleLayersMap,
        coordinateAdapter,
        layersConfig
    });

    // Attach MapLibre click handler to the map instance
    useEffect(() => {
        if (!map || isSketching) {
            return;
        }

        const handleMapLibreClick = (e: any) => {
            // Clear any previous graphics immediately
            clearGraphics(map);

            // MapLibre's click event provides point with screen coordinates
            if (e.point) {
                handleMapClick({
                    screenX: e.point.x,
                    screenY: e.point.y
                });
            }
        };

        // Use optional chaining to safely add and remove event listener
        map?.on?.('click', handleMapLibreClick);
        return () => {
            map?.off?.('click', handleMapLibreClick);
        };
    }, [map, isSketching, handleMapClick]);

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
        handleOnContextMenu,
        coordinates,
        setCoordinates,
        layersConfig: processedLayers,
    };
}