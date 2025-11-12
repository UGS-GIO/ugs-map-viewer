import { createContext } from "react";
import { LayerProps } from "@/lib/types/mapping-types";

/**
 * MapContext interface for MapLibre GL JS
 *
 * Provides access to the MapLibre map instance and shared functionality
 */
export type MapContextProps = {
    // MapLibre map instance
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
