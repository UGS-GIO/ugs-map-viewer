import { createContext, useState, useCallback, useRef } from "react";
import type SceneView from "@arcgis/core/views/SceneView";
import type MapView from "@arcgis/core/views/MapView";
import { LayerProps } from "@/lib/types/mapping-types";
import { init } from "@/lib/map/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type MapContextProps = {
    view?: SceneView | MapView,
    map?: __esri.Map,
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

export const MapContext = createContext<MapContextProps>({
    view: undefined,
    map: undefined,
    loadMap: async () => { },
    isSketching: false,
    setIsSketching: () => { }
});

export function MapProvider({ children }: { children: React.ReactNode }) {
    const [view, setView] = useState<SceneView | MapView>();
    const [map, setMap] = useState<__esri.Map>();
    const [isSketching, setIsSketching] = useState<boolean>(false);
    const isMobile = useIsMobile();

    // Use refs to access the latest view/map without causing loadMap to recreate
    const viewRef = useRef<SceneView | MapView>();
    const mapRef = useRef<__esri.Map>();

    // Keep refs in sync with state
    viewRef.current = view;
    mapRef.current = map;

    const loadMap = useCallback(async ({
        container,
        zoom = 10,
        center = [0, 0],
        layers = []
    }: {
        container: HTMLDivElement,
        zoom?: number,
        center?: [number, number],
        layers?: LayerProps[]
    }) => {
        // If the view already exists, we just sync visibility without rebuilding the map.
        if (viewRef.current && mapRef.current) {
            // Create a simple lookup map of what *should* be visible from the URL state
            const visibilityMap = new Map();

            // Helper to recursively get all titles and their visibility
            const populateVisibilityMap = (layerConfigs: LayerProps[]) => {
                layerConfigs.forEach(config => {
                    if (config.title) {
                        visibilityMap.set(config.title, config.visible);
                    }
                    if (config.type === 'group' && 'layers' in config) {
                        populateVisibilityMap(config.layers || []);
                    }
                });
            };
            populateVisibilityMap(layers);

            // Iterate through the LIVE layers on the map and update them
            mapRef.current.allLayers.forEach(liveLayer => {
                const shouldBeVisible = visibilityMap.get(liveLayer.title);
                if (shouldBeVisible !== undefined && liveLayer.visible !== shouldBeVisible) {
                    liveLayer.visible = shouldBeVisible;
                }
            });
        }

        // If the view does NOT exist, run the initial creation logic.
        else {
            const { map: initMap, view: initView } = await init(container, isMobile, { zoom, center }, layers, 'map');

            setView(initView);
            setMap(initMap);
        }
    }, [isMobile]);

    return (
        <MapContext.Provider value={{ view, map, loadMap, isSketching, setIsSketching }}>
            {children}
        </MapContext.Provider>
    )
}