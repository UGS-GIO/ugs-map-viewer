import { useState, useCallback, useRef } from "react";
import { LayerProps } from "@/lib/types/mapping-types";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapContext, MapContextProps } from "@/context/map-context";

/**
 * MapLibre Map Provider (Stub)
 * Manages MapLibre GL JS map initialization and state
 *
 * Exposes the unified MapContext with:
 * - map: maplibre-gl.Map instance
 * - loadMap: Initialization and layer sync function
 * - isSketching: Sketch mode state
 * - setIsSketching: Sketch mode setter
 * - view: undefined (MapLibre doesn't have separate view)
 *
 * Note: MapLibre API differences from ArcGIS:
 * - No separate View class, Map contains both rendering and interaction
 * - No view.extent, instead use map.getBounds()
 * - Coordinates are [lng, lat]
 *
 * TODO: Phase 1.1
 * - Create MapLibre factory function (similar to ArcGIS init())
 * - Initialize Map with style and layers
 * - Implement layer visibility toggling
 * - Handle click events and feature queries
 */
export function MapLibreMapProvider({ children }: { children: React.ReactNode }) {
    const [map, _setMap] = useState<any>();
    const [isSketching, setIsSketching] = useState<boolean>(false);
    const isMobile = useIsMobile();

    // Use refs to access the latest map without causing loadMap to recreate
    const mapRef = useRef<any>();

    // Keep ref in sync with state
    mapRef.current = map;

    const loadMap = useCallback(async (_params: {
        container: HTMLDivElement,
        zoom?: number,
        center?: [number, number],
        layers?: LayerProps[]
    }) => {
        // TODO: Phase 1.1 - Implement MapLibre initialization
        // 1. Create MapLibre Map instance with:
        //    - container
        //    - style (basemap)
        //    - initial center and zoom
        // 2. Add layers to the map (converting from LayerProps to MapLibre sources/layers)
        // 3. Handle layer visibility toggling (similar to ArcGIS)

        console.warn('MapLibreMapProvider.loadMap not yet implemented');

        // Temporary: throw error to prevent silent failures
        throw new Error('MapLibre provider not yet implemented. Set VITE_MAP_IMPL=arcgis');
    }, [isMobile]);

    const value: MapContextProps = {
        map,
        loadMap,
        isSketching,
        setIsSketching
    };

    return (
        <MapContext.Provider value={value}>
            {children}
        </MapContext.Provider>
    )
}
