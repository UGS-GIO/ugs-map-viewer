import { createContext } from "react";
import { LayerProps } from "@/lib/types/mapping-types";

/**
 * Unified MapContext interface
 *
 * This interface abstracts over both ArcGIS and MapLibre implementations.
 * Consumers use this and don't need to know which implementation is active.
 *
 * Note: This is a union type where view is optional (MapLibre has no view)
 * Consumers should check which fields are defined to determine the active implementation
 */
export type MapContextProps = {
    // ArcGIS specific
    view?: any, // SceneView | MapView - using any to avoid hard dependency

    // MapLibre specific
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
    view: undefined,
    map: undefined,
    loadMap: async () => { },
    isSketching: false,
    setIsSketching: () => { }
});

MapContext.displayName = 'MapContext';
