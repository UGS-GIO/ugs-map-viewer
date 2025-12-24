import { useEffect, useRef, useCallback } from 'react';
import type { MapLibreMap } from '@/lib/types/map-types';
import type { TerraDraw } from 'terra-draw';

export type DrawMode = 'off' | 'rectangle' | 'polygon';

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

interface UseDrawSelectProps {
    map: MapLibreMap | null;
    drawMode: DrawMode;
    onDrawComplete?: (geometry: DrawGeometry) => void;
    onDrawingChange?: (isDrawing: boolean) => void;
}

/**
 * Hook for drawing selections on the map using Terra Draw
 * Supports rectangle and polygon drawing modes
 */
export function useDrawSelect({ map, drawMode, onDrawComplete, onDrawingChange }: UseDrawSelectProps) {
    const drawRef = useRef<TerraDraw | null>(null);
    const onDrawCompleteRef = useRef(onDrawComplete);
    const currentModeRef = useRef<DrawMode>('off');

    // Keep ref in sync with prop
    onDrawCompleteRef.current = onDrawComplete;

    useEffect(() => {
        const shouldDrawBeActive = map && drawMode !== 'off';

        if (!shouldDrawBeActive) {
            if (drawRef.current) {
                try {
                    drawRef.current.stop();
                } catch (e) {
                    console.error('[DrawSelect] Error stopping draw:', e);
                }
                drawRef.current = null;
                onDrawingChange?.(false);
            }
            currentModeRef.current = 'off';
            return;
        }

        // If mode changed but draw is already initialized, just switch mode
        if (drawRef.current && currentModeRef.current !== 'off') {
            const terraMode = drawMode === 'rectangle' ? 'rectangle' : 'polygon';
            drawRef.current.setMode(terraMode);
            currentModeRef.current = drawMode;
            return;
        }

        const initializeDraw = async () => {
            try {
                const [
                    { TerraDraw, TerraDrawPolygonMode, TerraDrawRectangleMode, TerraDrawSelectMode },
                    { TerraDrawMapLibreGLAdapter }
                ] = await Promise.all([
                    import('terra-draw'),
                    import('terra-draw-maplibre-gl-adapter')
                ]);

                const sharedStyles = {
                    fillColor: '#0078A8',
                    fillOpacity: 0.2,
                    outlineColor: '#0078A8',
                    outlineWidth: 2,
                };

                const draw = new TerraDraw({
                    adapter: new TerraDrawMapLibreGLAdapter({ map }),
                    modes: [
                        new TerraDrawSelectMode(),
                        new TerraDrawPolygonMode({
                            styles: {
                                ...sharedStyles,
                                closingPointColor: '#0078A8',
                                closingPointOutlineColor: '#ffffff',
                                closingPointWidth: 6,
                                closingPointOutlineWidth: 2
                            }
                        }),
                        new TerraDrawRectangleMode({
                            styles: sharedStyles
                        })
                    ]
                });

                draw.start();
                const terraMode = drawMode === 'rectangle' ? 'rectangle' : 'polygon';
                draw.setMode(terraMode);
                drawRef.current = draw;
                currentModeRef.current = drawMode;

                let isCompleting = false;

                const handleFinish = (_id: string | number, context: { action: string; mode: string }) => {
                    if ((context.mode === 'polygon' || context.mode === 'rectangle') && context.action === 'draw') {
                        const features = draw.getSnapshot();

                        if (features.length > 0) {
                            const feature = features[features.length - 1] as GeoJSONFeature;

                            if (feature.geometry.type === 'Polygon') {
                                const rings = feature.geometry.coordinates as number[][][];
                                const geometry: DrawGeometry = {
                                    type: 'polygon',
                                    rings: rings
                                };

                                isCompleting = true;
                                onDrawingChange?.(false);
                                onDrawCompleteRef.current?.(geometry);

                                // Keep shape visible after completion
                                draw.setMode('select');
                            }
                        }
                    }
                };

                const handleChange = () => {
                    if (isCompleting) return;
                    const features = draw.getSnapshot();
                    const hasIncomplete = features.some(f => {
                        const geom = (f as GeoJSONFeature).geometry;
                        return geom.type === 'LineString' || geom.type === 'Point';
                    });
                    onDrawingChange?.(hasIncomplete);
                };

                draw.on('finish', handleFinish);
                draw.on('change', handleChange);
            } catch (error) {
                console.error('[DrawSelect] Error initializing Terra Draw:', error);
            }
        };

        let cleanedUp = false;

        if (map.isStyleLoaded()) {
            initializeDraw();
        } else {
            const handleStyleLoad = () => {
                if (!cleanedUp) initializeDraw();
            };
            map.once('style.load', handleStyleLoad);
        }

        return () => {
            cleanedUp = true;
            if (drawRef.current) {
                try {
                    drawRef.current.stop();
                } catch (e) {
                    console.error('[DrawSelect] Error stopping draw:', e);
                }
                drawRef.current = null;
                onDrawingChange?.(false);
            }
        };
    }, [map, drawMode, onDrawingChange]);

    const clearDrawing = useCallback(() => {
        if (!drawRef.current) return;
        const features = drawRef.current.getSnapshot();
        features.forEach(feature => {
            if (feature.id) {
                drawRef.current?.removeFeatures([feature.id]);
            }
        });
        onDrawingChange?.(false);
    }, [onDrawingChange]);

    return {
        clearDrawing,
        draw: drawRef.current
    };
}
