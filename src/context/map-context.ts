import { createContext } from "react";
import { LayerProps } from "@/lib/types/mapping-types";

/**
 * MapContext interface for MapLibre GL JS
 *
 * Provides access to map instance and shared functionality
 */
export type MapContextProps = {
    // MapLibre map instance
    map?: any, // maplibre-gl.Map - using any to avoid hard dependency

    // Map initialization and management
    loadMap?: ({
        container,
        zoom,
        center,
        layers
    }: {
        container: HTMLDivElement,
        zoom?: number,
        center?: [number, number],
        layers?: LayerProps[]
    }) => Promise<void>,

    // Sketching state for drawing tools (e.g., Terra Draw)
    isSketching: boolean
    setIsSketching?: (isSketching: boolean) => void
}

/**
 * MapContext for MapLibre GL JS
 *
 * Created here and imported by:
 * - useMap hook (for consumers)
 * - MapLibreMapProvider (provides the map instance)
 */
export const MapContext = createContext<MapContextProps>({
    map: undefined,
    loadMap: async () => { },
    isSketching: false,
    setIsSketching: () => { }
});

MapContext.displayName = 'MapContext';
