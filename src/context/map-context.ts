import { createContext } from "react";
import type { Polygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { DrawMode } from "@/components/maps/types";

export type { DrawMode }

export type MapContextProps = {
    map?: MapLibreMap

    isSketching: boolean
    setIsSketching: (isSketching: boolean) => void

    onLayerTurnedOff: (layerTitle: string) => void

    // Draw lifecycle — owned by useMapContextState
    activeDrawShape: DrawMode
    startDraw: (mode: 'rectangle' | 'polygon', onComplete?: (polygon: Polygon) => void, onCancel?: () => void) => void
    cancelDraw: () => void
    handleDrawComplete: (polygon: Polygon) => boolean

    // Registration — container registers its callbacks
    registerPrepareForDraw: (fn: () => void) => void
    registerLayerTurnedOff: (fn: (title: string) => void) => void
    onMapReady: (map: MapLibreMap) => void
}

export const MapContext = createContext<MapContextProps>({
    map: undefined,
    isSketching: false,
    setIsSketching: () => { },
    onLayerTurnedOff: () => { },
    activeDrawShape: 'off',
    startDraw: () => { },
    cancelDraw: () => { },
    handleDrawComplete: () => false,
    registerPrepareForDraw: () => { },
    registerLayerTurnedOff: () => { },
    onMapReady: () => { },
});

MapContext.displayName = 'MapContext';
