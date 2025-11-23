import { useEffect, useRef, useState } from 'react';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
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
    map: MapLibreMap | null;
    onDrawComplete?: (geometry: DrawGeometry) => void;
}

export function useTerraDrawPolygon({ map, onDrawComplete }: UseTerraDraw) {
    const drawRef = useRef<TerraDraw | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!map) {
            return;
        }

        const initializeDraw = () => {

            try {
                // Initialize Terra Draw with MapLibre
                const draw = new TerraDraw({
                    adapter: new TerraDrawMapLibreGLAdapter({ map }),
                    modes: [
                        new TerraDrawSelectMode(),
                        new TerraDrawPolygonMode({
                            styles: {
                                fillColor: '#3b82f6',
                                fillOpacity: 0.4,
                                outlineColor: '#3b82f6',
                                outlineWidth: 2,
                                closingPointColor: '#3b82f6',
                                closingPointOutlineColor: '#ffffff',
                                closingPointWidth: 4,
                                closingPointOutlineWidth: 2
                            }
                        })
                    ]
                });

                // Start the drawing system
                draw.start();

                drawRef.current = draw;
                setIsReady(true);

                // Listen to finish events (when user completes drawing)
                const handleFinish = (_id: string | number, context: { action: string; mode: string }) => {
                    if (context.mode === 'polygon' && context.action === 'draw') {
                        // Get all features from the store
                        const features = draw.getSnapshot();

                        if (features.length > 0) {
                            const feature = features[features.length - 1] as GeoJSONFeature;

                            // Convert from GeoJSON to our expected format
                            if (feature.geometry.type === 'Polygon') {
                                const rings = feature.geometry.coordinates as number[][][];
                                const geometry: DrawGeometry = {
                                    type: 'polygon',
                                    rings: rings
                                };

                                onDrawComplete?.(geometry);
                            }
                        }
                    }
                };

                draw.on('finish', handleFinish);
            } catch (error) {
                console.error('[TerraDraw] Error initializing Terra Draw:', error);
                console.error('[TerraDraw] Error details:', error instanceof Error ? error.message : String(error));
                setIsReady(false);
            }
        };

        // Wait for map to be ready before initializing Terra Draw
        // Terra Draw needs layers to be present before it can add its own
        // Use a small delay to ensure map is fully ready
        // MapLibre's isStyleLoaded() can be unreliable during initialization
        const timeoutId = setTimeout(() => {
            initializeDraw();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (drawRef.current) {
                try {
                    drawRef.current.stop();
                } catch (e) {
                    console.error('[TerraDraw] Error stopping draw:', e);
                }
                drawRef.current = null;
                setIsReady(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    const startPolygonDraw = () => {
        if (!drawRef.current) {
            console.warn('[TerraDraw] Draw not initialized');
            return;
        }

        drawRef.current.setMode('polygon');
    };

    const clearDrawings = () => {
        if (!drawRef.current) return;

        const features = drawRef.current.getSnapshot();
        features.forEach(feature => {
            if (feature.id) {
                drawRef.current?.removeFeatures([feature.id]);
            }
        });
    };

    const cancelDraw = () => {
        if (!drawRef.current) return;

        drawRef.current.setMode('select');
        clearDrawings();
    };

    return {
        startPolygonDraw,
        clearDrawings,
        cancelDraw,
        draw: drawRef.current,
        isReady
    };
}
