import { useEffect, useRef } from 'react';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { MapLibreMap } from '@/lib/types/map-types';

interface DrawGeometry {
    type: 'polygon';
    rings: number[][][];
}

interface GeoJSONFeature {
    id: string;
    type: 'Feature';
    geometry: {
        type: string;
        coordinates: number[][][] | number[] | number;
    };
    properties: Record<string, unknown>;
}

interface UseTerraDraw {
    map: MapLibreMap;
    onDrawComplete?: (geometry: DrawGeometry) => void;
}

export function useTerraDrawPolygon({ map, onDrawComplete }: UseTerraDraw) {
    const drawRef = useRef<TerraDraw | null>(null);

    useEffect(() => {
        if (!map) {
            console.log('[TerraDraw] Map not available');
            return;
        }

        try {
            console.log('[TerraDraw] Initializing Terra Draw');

            // Initialize Terra Draw with MapLibre
            const draw = new TerraDraw({
                adapter: new TerraDrawMapLibreGLAdapter({ map }),
                modes: [new TerraDrawPolygonMode()]
            });

            // Start the drawing system
            draw.start();
            drawRef.current = draw;

            console.log('[TerraDraw] Terra Draw initialized and started');

            // Listen to finish events (when user completes drawing)
            const handleFinish = (id: string | number, context: { action: string; mode: string }) => {
                console.log('[TerraDraw] Finish event - id:', id, 'context:', context);

                if (context.mode === 'polygon' && context.action === 'draw') {
                    // Get all features from the store
                    const features = draw.getSnapshot();
                    console.log('[TerraDraw] Features snapshot:', features);

                    if (features.length > 0) {
                        const feature = features[features.length - 1] as GeoJSONFeature; // Get the last drawn feature
                        console.log('[TerraDraw] Last feature:', feature);

                        // Convert from GeoJSON to our expected format
                        if (feature.geometry.type === 'Polygon') {
                            const rings = feature.geometry.coordinates as number[][][];
                            const geometry: DrawGeometry = {
                                type: 'polygon',
                                rings: rings
                            };

                            console.log('[TerraDraw] Calling onDrawComplete with geometry:', geometry);
                            onDrawComplete?.(geometry);
                        }
                    }
                }
            };

            draw.on('finish', handleFinish);

            return () => {
                console.log('[TerraDraw] Cleaning up Terra Draw');
                draw.stop();
            };
        } catch (error) {
            console.error('[TerraDraw] Error initializing Terra Draw:', error);
        }
    }, [map, onDrawComplete]);

    const startPolygonDraw = () => {
        if (!drawRef.current) {
            console.warn('[TerraDraw] Draw not initialized');
            return;
        }

        console.log('[TerraDraw] Starting polygon mode');
        drawRef.current.setMode('polygon');
    };

    const clearDrawings = () => {
        if (!drawRef.current) return;

        console.log('[TerraDraw] Clearing all drawings');
        const features = drawRef.current.getSnapshot();
        features.forEach(feature => {
            if (feature.id) {
                drawRef.current?.removeFeatures([feature.id]);
            }
        });
    };

    const cancelDraw = () => {
        if (!drawRef.current) return;

        console.log('[TerraDraw] Canceling draw');
        drawRef.current.setMode('select');
        clearDrawings();
    };

    return {
        startPolygonDraw,
        clearDrawings,
        cancelDraw,
        draw: drawRef.current
    };
}
