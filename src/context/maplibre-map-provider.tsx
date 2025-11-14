import { useState, useCallback, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { LayerProps } from "@/lib/types/mapping-types";
import { createMapFactory } from "@/lib/map/factory/factory";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapContext, MapContextProps } from "@/context/map-context";
import { useMapPositionUrlParams } from "@/hooks/use-map-position-url-params";

/**
 * MapLibre Map Provider
 * Manages MapLibre GL JS map initialization and state
 * Uses the MapFactory for initialization
 *
 * Provides MapContext with:
 * - map: maplibre-gl.Map instance
 * - loadMap: Initialization and layer sync function
 * - isSketching: Sketch mode state
 * - setIsSketching: Sketch mode setter
 * - getIsSketching: Synchronous sketch state check
 * - shouldIgnoreNextClick/setIgnoreNextClick/consumeIgnoreClick: Click ignore flags for drawing tools
 */
export function MapLibreMapProvider({ children }: { children: React.ReactNode }) {
    const [map, setMap] = useState<maplibregl.Map>();
    const [isSketching, setIsSketching] = useState<boolean>(false);
    const isMobile = useIsMobile();

    // Use refs to access the latest map without causing loadMap to recreate
    const mapRef = useRef<maplibregl.Map>();

    // Use ref for synchronous sketching state access
    const isSketchingRef = useRef<boolean>(false);

    // Track when we should ignore the next click (e.g., finishing a draw)
    const ignoreNextClickRef = useRef<boolean>(false);

    // Keep refs in sync with state
    mapRef.current = map;
    isSketchingRef.current = isSketching;

    // Sync map position with URL parameters
    useMapPositionUrlParams(map || null);

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
        // If the map already exists, we just sync visibility without rebuilding the map.
        if (mapRef.current) {
            // Create a simple lookup map of what *should* be visible from the URL state
            const visibilityMap = new Map<string, boolean>();

            // Helper to recursively get all titles and their visibility
            const populateVisibilityMap = (layerConfigs: LayerProps[]) => {
                for (const config of layerConfigs) {
                    if (config.title) {
                        visibilityMap.set(config.title, config.visible ?? true);
                    }
                    if (config.type === 'group' && 'layers' in config) {
                        populateVisibilityMap(config.layers || []);
                    }
                }
            };
            populateVisibilityMap(layers);

            // Iterate through the LIVE layers on the map and update visibility
            const style = mapRef.current.getStyle();
            if (style && style.layers) {
                for (const layer of style.layers) {
                    const metadata = layer.metadata as Record<string, unknown> | undefined;
                    const layerTitle = metadata?.title as string | undefined;

                    if (layerTitle) {
                        const shouldBeVisible = visibilityMap.get(layerTitle);
                        if (shouldBeVisible !== undefined) {
                            const currentVisibility = mapRef.current.getLayoutProperty(layer.id, 'visibility');
                            const isCurrentlyVisible = currentVisibility !== 'none';
                            if (isCurrentlyVisible !== shouldBeVisible) {
                                mapRef.current.setLayoutProperty(
                                    layer.id,
                                    'visibility',
                                    shouldBeVisible ? 'visible' : 'none'
                                );
                            }
                        }
                    }
                }
            }
        }

        // If the map does NOT exist, run the initial creation logic.
        else {
            const factory = createMapFactory();
            const result = await factory.init(container, isMobile, { zoom, center }, layers);

            if (result.map && 'getStyle' in result.map) {
                await factory.addLayersToMap(result.map, layers);
                setMap(result.map as maplibregl.Map);
            }
        }
    }, [isMobile]);

    // Function to get sketching state synchronously (avoids React async state issues)
    const getIsSketching = useCallback(() => {
        return isSketchingRef.current;
    }, []);

    // Check if next click should be ignored (e.g., from finishing a draw)
    const shouldIgnoreNextClick = useCallback(() => {
        return ignoreNextClickRef.current;
    }, []);

    // Set the ignore flag (e.g., when finishing a draw)
    const setIgnoreNextClick = useCallback((ignore: boolean) => {
        ignoreNextClickRef.current = ignore;
    }, []);

    // Consume and clear the ignore flag
    const consumeIgnoreClick = useCallback(() => {
        ignoreNextClickRef.current = false;
    }, []);

    const value: MapContextProps = {
        map,
        loadMap,
        isSketching,
        setIsSketching,
        getIsSketching,
        shouldIgnoreNextClick,
        setIgnoreNextClick,
        consumeIgnoreClick
    };

    return (
        <MapContext.Provider value={value}>
            {children}
        </MapContext.Provider>
    )
}
