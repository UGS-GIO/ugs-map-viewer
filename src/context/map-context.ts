import { createContext } from "react";
import type { Polygon } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { ClickedFeature, DrawMode } from "@/components/maps/types";
import type { MeasureMode } from "@/lib/map/measure-store";

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

    // Measure tool — routed through the container so it cancels the other map modes
    setMeasureMode: (mode: MeasureMode | undefined) => void
    registerSetMeasureMode: (fn: (mode: MeasureMode | undefined) => void) => void

    // Feature selection — container registers, consumers (e.g. sidebar filters) call
    selectFeatures: (features: ClickedFeature[]) => void
    clearAllSelections: () => void
    registerSelectFeatures: (fn: (features: ClickedFeature[]) => void) => void
    registerClearSelections: (fn: () => void) => void

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
    setMeasureMode: () => { },
    registerSetMeasureMode: () => { },
    selectFeatures: () => { },
    clearAllSelections: () => { },
    registerSelectFeatures: () => { },
    registerClearSelections: () => { },
    registerPrepareForDraw: () => { },
    registerLayerTurnedOff: () => { },
    onMapReady: () => { },
});

MapContext.displayName = 'MapContext';
