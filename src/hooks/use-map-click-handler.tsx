import { useCallback } from 'react';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import type { MapLibreMap } from '@/lib/types/map-types';
import type { LayerProps } from '@/lib/types/mapping-types';
import { buildVisibleLayersMap, type VisibleLayersMap } from '@/lib/map/layer-info-utils';

interface MapClickEvent {
    screenX: number;
    screenY: number;
}

interface UseMapClickHandlerProps {
    map: MapLibreMap;
    isSketching: boolean | (() => boolean);
    shouldIgnoreNextClick?: (() => boolean) | undefined;
    consumeIgnoreClick?: (() => void) | undefined;
    onPointClick: (point: MapPoint) => void;
    setVisibleLayersMap: (layers: VisibleLayersMap) => void;
    coordinateAdapter: CoordinateAdapter;
    layersConfig?: LayerProps[] | null;
}

/**
 * Custom hook to handle MapLibre map click events.
 * Clears existing graphics, updates visible layers, converts screen coordinates to map coordinates,
 * and triggers a callback with the map point.
 */
export function useMapClickHandler({
    map,
    isSketching,
    shouldIgnoreNextClick,
    consumeIgnoreClick,
    onPointClick,
    setVisibleLayersMap,
    coordinateAdapter,
    layersConfig
}: UseMapClickHandlerProps) {

    const handleMapClick = useCallback((event: MapClickEvent) => {
        // Check if we should ignore this click (e.g., finishing a draw)
        if (shouldIgnoreNextClick?.()) {
            consumeIgnoreClick?.();
            return;
        }

        const sketching = typeof isSketching === 'function' ? isSketching() : isSketching;
        if (sketching) {
            return;
        }

        if (!map) {
            return;
        }

        // Build visibleLayersMap from layersConfig using shared utility
        // Pass map instance to check actual layer visibility on the map
        if (layersConfig && Array.isArray(layersConfig)) {
            const visibleLayersMap = buildVisibleLayersMap(layersConfig, map);
            setVisibleLayersMap(visibleLayersMap);
        }

        // Convert screen coordinates to map coordinates using adapter
        const screenPoint: ScreenPoint = {
            x: event.screenX,
            y: event.screenY
        };

        const mapPoint = coordinateAdapter.screenToMap(screenPoint, map);

        // Trigger the callback with the abstracted map point
        onPointClick(mapPoint);
    }, [map, isSketching, shouldIgnoreNextClick, consumeIgnoreClick, onPointClick, setVisibleLayersMap, coordinateAdapter, layersConfig]);

    return { handleMapClick };
}
