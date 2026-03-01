import { createContext } from "react";
import type { Polygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

export type DrawMode = 'off' | 'rectangle' | 'polygon'

export type MapContextProps = {
    map?: MapLibreMap

    isSketching: boolean
    setIsSketching: (isSketching: boolean) => void

    onLayerTurnedOff: (layerTitle: string) => void

    // Draw lifecycle — owned by useMapContextState
    drawMode: DrawMode
    setDrawMode: (mode: DrawMode) => void
    startDraw: (mode: 'rectangle' | 'polygon', onComplete: (polygon: Polygon) => void, onCancel?: () => void) => void
    cancelDraw: () => void
    onDrawComplete: ((polygon: Polygon) => void) | undefined

    // Registration — container registers its callbacks
    registerClearSpatialFilter: (fn: () => void) => void
    registerLayerTurnedOff: (fn: (title: string) => void) => void
    onMapReady: (map: MapLibreMap) => void
}

export const MapContext = createContext<MapContextProps>({
    map: undefined,
    isSketching: false,
    setIsSketching: () => { },
    onLayerTurnedOff: () => { },
    drawMode: 'off',
    setDrawMode: () => { },
    startDraw: () => { },
    cancelDraw: () => { },
    onDrawComplete: undefined,
    registerClearSpatialFilter: () => { },
    registerLayerTurnedOff: () => { },
    onMapReady: () => { },
});

MapContext.displayName = 'MapContext';
