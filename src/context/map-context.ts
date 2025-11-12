import { createContext } from "react";
import { LayerProps } from "@/lib/types/mapping-types";

/**
 * MapContext interface supporting both ArcGIS and MapLibre implementations
 *
 * Provides access to map instances and shared functionality
 */
export type MapContextProps = {
    // ArcGIS map instance (present when using ArcGIS implementation)
    view?: any, // MapView - using any to avoid hard dependency

    // MapLibre map instance (present when using MapLibre implementation)
    map?: any, // maplibre-gl.Map - using any to avoid hard dependency

    // Shared interface
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
    isSketching: boolean
    setIsSketching?: (isSketching: boolean) => void
}

/**
 * Unified MapContext
 *
 * Created here and imported by:
 * - useMap hook (for consumers)
 * - map-provider.tsx (wrapper component that conditionally renders ArcGIS or MapLibre)
 */
export const MapContext = createContext<MapContextProps>({
    map: undefined,
    loadMap: async () => { },
    isSketching: false,
    setIsSketching: () => { }
});

MapContext.displayName = 'MapContext';
