import { useState, useCallback, useRef, useEffect } from "react";
import type maplibregl from "maplibre-gl";
import { LayerProps } from "@/lib/types/mapping-types";
import { createMapFactory } from "@/lib/map/factory/factory";
import { useIsMobile } from "@/hooks/use-mobile";
import { MapContext, MapContextProps } from "@/context/map-context";
import { useMapPositionUrlParams } from "@/hooks/use-map-position-url-params";

/**
 * MapLibre Map Provider
 * Manages MapLibre GL JS map initialization and state
 * Uses a stable container element created outside React's render cycle
 */
export function MapLibreMapProvider({ children }: { children: React.ReactNode }) {
    const [map, setMap] = useState<maplibregl.Map>();
    const [isSketching, setIsSketching] = useState<boolean>(false);
    const isMobile = useIsMobile();

    // Source of truth for map instance (ref doesn't trigger re-renders)
    const mapInstanceRef = useRef<maplibregl.Map | null>(null);

    // Stable container - created once, lives outside React's render cycle
    const stableContainerRef = useRef<HTMLDivElement | null>(null);

    // Track where the container is currently mounted
    const mountTargetRef = useRef<HTMLDivElement | null>(null);

    // Lock to prevent concurrent map creation
    const isCreatingMapRef = useRef<boolean>(false);

    // Use ref for synchronous sketching state access
    const isSketchingRef = useRef<boolean>(false);

    // Track when we should ignore the next click (e.g., finishing a draw)
    const ignoreNextClickRef = useRef<boolean>(false);

    // Keep sketching ref in sync with state
    isSketchingRef.current = isSketching;

    // Sync map position with URL parameters
    useMapPositionUrlParams(map || null);

    // Create stable container on mount, cleanup on unmount
    useEffect(() => {
        console.log('[MapProvider] useEffect mount');

        // Create the stable container element
        if (!stableContainerRef.current) {
            const container = document.createElement('div');
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            stableContainerRef.current = container;
            console.log('[MapProvider] Created stable container');
        }

        // Cleanup on provider unmount
        return () => {
            console.log('[MapProvider] useEffect cleanup - mapExists:', !!mapInstanceRef.current);
            if (mapInstanceRef.current) {
                try {
                    mapInstanceRef.current.remove();
                    console.log('[MapProvider] Map removed');
                } catch (e) {
                    console.log('[MapProvider] Error removing map:', e);
                }
                mapInstanceRef.current = null;
                setMap(undefined);
            }
        };
    }, []);

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
        console.log('[loadMap] called - stableContainer:', !!stableContainerRef.current, 'mapInstance:', !!mapInstanceRef.current, 'isCreating:', isCreatingMapRef.current);

        // Ensure we have a stable container
        if (!stableContainerRef.current) {
            console.log('[loadMap] No stable container, returning');
            return;
        }

        // Mount the stable container into the target if not already there
        if (mountTargetRef.current !== container) {
            console.log('[loadMap] Mounting to new container');
            if (stableContainerRef.current.parentNode) {
                stableContainerRef.current.parentNode.removeChild(stableContainerRef.current);
            }
            container.appendChild(stableContainerRef.current);
            mountTargetRef.current = container;
        }

        // If map already exists, just sync layer visibility
        if (mapInstanceRef.current) {
            console.log('[loadMap] Map exists, syncing visibility');
            const visibilityMap = new Map<string, boolean>();

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

            const style = mapInstanceRef.current.getStyle();
            if (style?.layers) {
                for (const layer of style.layers) {
                    const metadata = layer.metadata as Record<string, unknown> | undefined;
                    const layerTitle = metadata?.title as string | undefined;

                    if (layerTitle) {
                        const shouldBeVisible = visibilityMap.get(layerTitle);
                        if (shouldBeVisible !== undefined) {
                            const currentVisibility = mapInstanceRef.current.getLayoutProperty(layer.id, 'visibility');
                            const isCurrentlyVisible = currentVisibility !== 'none';
                            if (isCurrentlyVisible !== shouldBeVisible) {
                                mapInstanceRef.current.setLayoutProperty(
                                    layer.id,
                                    'visibility',
                                    shouldBeVisible ? 'visible' : 'none'
                                );
                            }
                        }
                    }
                }
            }
            return;
        }

        // Prevent concurrent map creation
        if (isCreatingMapRef.current) {
            console.log('[loadMap] Already creating, returning');
            return;
        }
        isCreatingMapRef.current = true;
        console.log('[loadMap] Starting map creation');

        try {
            const factory = createMapFactory();
            const result = await factory.init(stableContainerRef.current, isMobile, { zoom, center }, layers);
            console.log('[loadMap] Factory init completed');

            if (result.map && 'getStyle' in result.map) {
                const mapInstance = result.map as maplibregl.Map;
                mapInstanceRef.current = mapInstance;
                setMap(mapInstance);
                console.log('[loadMap] Map set successfully');
            }
        } finally {
            isCreatingMapRef.current = false;
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
    );
}
