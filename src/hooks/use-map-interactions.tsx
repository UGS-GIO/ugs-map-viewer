import { useCallback, useState } from "react";
import { useMap } from "@/hooks/use-map";
import { createCoordinateAdapter } from "@/lib/map/coordinates/factory";
import { useGetLayerConfigsData } from "./use-get-layer-configs";
import { createPinGraphic, clearGraphics } from "@/lib/map/highlight-utils";

type UseMapInteractionsType = {
    layersConfig: ReturnType<typeof useGetLayerConfigsData>;
};

/**
 * Map interactions hook for MapLibre GL JS
 * Handles context menu (right-click) events and coordinate conversion
 */
export const useMapInteractions = ({ layersConfig }: UseMapInteractionsType) => {
    const [visibleLayers, setVisibleLayers] = useState<Record<string, any>>();
    const { map } = useMap();

    // Handle right-click to show context menu and update coordinates
    const handleOnContextMenu = useCallback(
        (
            e: React.MouseEvent<HTMLDivElement>,
            hiddenTriggerRef: React.RefObject<HTMLDivElement>,
            setCoordinates: (coordinates: { x: string; y: string }) => void
        ) => {
            e.preventDefault();

            if (map) {
                const { offsetX: x, offsetY: y } = e.nativeEvent;

                // Convert screen coordinates to map coordinates using the coordinate adapter
                const adapter = createCoordinateAdapter();
                const mapCoords = adapter.screenToMap([x, y]);

                if (mapCoords) {
                    const [lng, lat] = mapCoords;
                    setCoordinates({ x: lng.toString(), y: lat.toString() });
                    clearGraphics(map);
                    createPinGraphic(lat, lng, map);
                }
            }

            if (hiddenTriggerRef.current) {
                const contextMenuEvent = new MouseEvent('contextmenu', {
                    bubbles: true,
                    clientX: e.clientX,
                    clientY: e.clientY,
                });
                hiddenTriggerRef.current.dispatchEvent(contextMenuEvent);
            }
        },
        [map]
    );

    return { handleOnContextMenu, visibleLayers };
};