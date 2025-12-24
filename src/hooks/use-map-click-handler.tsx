import { useCallback } from 'react';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import type { MapLibreMap } from '@/lib/types/map-types';

interface MapClickEvent {
    screenX: number;
    screenY: number;
    shiftKey?: boolean;
}

interface UseMapClickHandlerProps {
    map: MapLibreMap;
    isSketching: boolean | (() => boolean);
    shouldIgnoreNextClick?: (() => boolean) | undefined;
    consumeIgnoreClick?: (() => void) | undefined;
    onPointClick: (point: MapPoint, options?: { additive?: boolean }) => void;
    coordinateAdapter: CoordinateAdapter;
}

/**
 * Handles map click events - converts screen coordinates to map coordinates.
 * visibleLayersMap is now derived elsewhere, so this just handles coordinate conversion.
 */
export function useMapClickHandler({
    map,
    isSketching,
    shouldIgnoreNextClick,
    consumeIgnoreClick,
    onPointClick,
    coordinateAdapter,
}: UseMapClickHandlerProps) {

    const handleMapClick = useCallback((event: MapClickEvent) => {
        if (shouldIgnoreNextClick?.()) {
            consumeIgnoreClick?.();
            return;
        }

        const sketching = typeof isSketching === 'function' ? isSketching() : isSketching;
        if (sketching || !map) return;

        const screenPoint: ScreenPoint = { x: event.screenX, y: event.screenY };
        const mapPoint = coordinateAdapter.screenToMap(screenPoint, map);
        onPointClick(mapPoint, { additive: event.shiftKey ?? false });
    }, [map, isSketching, shouldIgnoreNextClick, consumeIgnoreClick, onPointClick, coordinateAdapter]);

    return { handleMapClick };
}
