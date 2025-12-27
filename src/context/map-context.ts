import { createContext } from "react";
import type { Polygon } from "geojson";

export type DrawMode = 'off' | 'rectangle' | 'polygon'

/**
 * MapContext interface for MapLibre GL JS
 *
 * Provides access to map instance and shared functionality
 */
export type MapContextProps = {
    // MapLibre map instance (undefined until map loads)
    map?: any // maplibre-gl.Map - using any to avoid hard dependency

    // Sketching state for drawing tools (e.g., Terra Draw)
    isSketching: boolean
    setIsSketching: (isSketching: boolean) => void
    getIsSketching: () => boolean
    shouldIgnoreNextClick: () => boolean
    setIgnoreNextClick: (ignore: boolean) => void
    consumeIgnoreClick: () => void

    // Layer toggle callback - called when a layer is turned off to clear its features from results
    onLayerTurnedOff: (layerTitle: string) => void

    // Drawing controls - shared TerraDraw instance
    drawMode: DrawMode
    startDraw: (mode: 'rectangle' | 'polygon', onComplete: (polygon: Polygon) => void) => void
    cancelDraw: () => void
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
    isSketching: false,
    setIsSketching: () => { },
    getIsSketching: () => false,
    shouldIgnoreNextClick: () => false,
    setIgnoreNextClick: () => { },
    consumeIgnoreClick: () => { },
    onLayerTurnedOff: () => { },
    drawMode: 'off',
    startDraw: () => { },
    cancelDraw: () => { },
});

MapContext.displayName = 'MapContext';
