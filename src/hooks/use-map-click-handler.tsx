import { useCallback } from 'react';
import { clearGraphics } from '@/lib/map/highlight-utils';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';

interface MapClickEvent {
    screenX: number;
    screenY: number;
}

interface UseMapClickHandlerProps {
    view: __esri.MapView | __esri.SceneView | undefined;
    isSketching: boolean;
    onPointClick: (point: MapPoint) => void;
    getVisibleLayers: (params: { view: __esri.MapView | __esri.SceneView }) => any;
    setVisibleLayersMap: (layers: any) => void;
    coordinateAdapter: CoordinateAdapter;
}

/**
 * Custom hook to handle map click events.
 * Clears existing graphics, updates visible layers, converts screen coordinates to map coordinates,
 * and triggers a callback with the map point.
 * Now uses abstracted coordinate system for better portability.
 * @param view - The ArcGIS MapView or SceneView instance.
 * @param isSketching - Boolean indicating if sketching mode is active.
 * @param onPointClick - Callback function to be called with the map point on click.
 * @param getVisibleLayers - Function to retrieve currently visible layers from the view.
 * @param setVisibleLayersMap - Function to update the state of visible layers.
 * @param coordinateAdapter - Adapter for coordinate system operations.
 * @returns An object containing the handleMapClick function.
 */
export function useMapClickHandler({
    view,
    isSketching,
    onPointClick,
    getVisibleLayers,
    setVisibleLayersMap,
    coordinateAdapter
}: UseMapClickHandlerProps) {

    const handleMapClick = useCallback((event: MapClickEvent) => {
        if (!view || isSketching) return;

        // Clear existing graphics
        clearGraphics(view);

        // Update visible layers state
        const layers = getVisibleLayers({ view });
        setVisibleLayersMap(layers.layerVisibilityMap);

        // Convert screen coordinates to map coordinates using adapter
        const screenPoint: ScreenPoint = {
            x: event.screenX,
            y: event.screenY
        };

        const mapPoint = coordinateAdapter.screenToMap(screenPoint, view);

        // Trigger the callback with the abstracted map point
        onPointClick(mapPoint);
    }, [view, isSketching, onPointClick, getVisibleLayers, setVisibleLayersMap, coordinateAdapter]);

    return { handleMapClick };
}