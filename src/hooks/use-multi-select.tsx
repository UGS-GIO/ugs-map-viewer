import { useEffect, useRef, useCallback } from 'react';
import type { MapLibreMap } from '@/lib/types/map-types';
import { useMultiSelect } from '@/context/multi-select-context';

// Type imports don't add to bundle
import type { TerraDraw } from 'terra-draw';

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

interface UseMultiSelectProps {
    map: MapLibreMap | null;
    onPolygonComplete?: (geometry: DrawGeometry) => void;
}

export function useMultiSelectTool({ map, onPolygonComplete }: UseMultiSelectProps) {
    const drawRef = useRef<TerraDraw | null>(null);
    const onPolygonCompleteRef = useRef(onPolygonComplete);
    const { isMultiSelectMode, setIsDrawing, setHasCompletedPolygon } = useMultiSelect();

    // Update ref when callback changes
    useEffect(() => {
        onPolygonCompleteRef.current = onPolygonComplete;
    }, [onPolygonComplete]);

    useEffect(() => {
        if (!map || !isMultiSelectMode) {
            if (drawRef.current) {
                console.log('[MultiSelect] Stopping Terra Draw');
                try {
                    drawRef.current.stop();
                } catch (e) {
                    console.error('[MultiSelect] Error stopping draw:', e);
                }
                drawRef.current = null;
                setIsDrawing(false);
                setHasCompletedPolygon(false);
            }
            return;
        }

        // Don't reinitialize if already initialized
        if (drawRef.current) {
            return;
        }

        console.log('[MultiSelect] Initializing Terra Draw for multi-select');

        const initializeDraw = async () => {
            try {
                // Lazy load Terra Draw only when multi-select mode is activated
                const [{ TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode }, { TerraDrawMapLibreGLAdapter }] = await Promise.all([
                    import('terra-draw'),
                    import('terra-draw-maplibre-gl-adapter')
                ]);

                const draw = new TerraDraw({
                    adapter: new TerraDrawMapLibreGLAdapter({ map }),
                    modes: [
                        new TerraDrawSelectMode(),
                        new TerraDrawPolygonMode({
                            styles: {
                                fillColor: '#f59e0b',
                                fillOpacity: 0.3,
                                outlineColor: '#f59e0b',
                                outlineWidth: 3,
                                closingPointColor: '#f59e0b',
                                closingPointOutlineColor: '#ffffff',
                                closingPointWidth: 6,
                                closingPointOutlineWidth: 2
                            }
                        })
                    ]
                });

                draw.start();
                draw.setMode('polygon');
                drawRef.current = draw;

                let isCompleting = false;

                const handleFinish = (id: string | number, context: { action: string; mode: string }) => {
                    console.log('[MultiSelect] Finish event - id:', id, 'context:', context);

                    if (context.mode === 'polygon' && context.action === 'draw') {
                        const features = draw.getSnapshot();
                        console.log('[MultiSelect] Features snapshot:', features);

                        if (features.length > 0) {
                            const feature = features[features.length - 1] as GeoJSONFeature;
                            console.log('[MultiSelect] Last feature:', feature);

                            if (feature.geometry.type === 'Polygon') {
                                const rings = feature.geometry.coordinates as number[][][];
                                const geometry: DrawGeometry = {
                                    type: 'polygon',
                                    rings: rings
                                };

                                console.log('[MultiSelect] Calling onPolygonComplete with geometry:', geometry);
                                isCompleting = true;
                                setIsDrawing(false);
                                setHasCompletedPolygon(true);
                                onPolygonCompleteRef.current?.(geometry);

                                // Keep polygon visible after completion
                                draw.setMode('select');
                            }
                        }
                    }
                };

                const handleChange = () => {
                    // Don't update isDrawing if we're in the middle of completing
                    if (isCompleting) {
                        return;
                    }
                    const features = draw.getSnapshot();
                    const hasIncompletePolygon = features.some(f => {
                        const geom = (f as GeoJSONFeature).geometry;
                        // A polygon is incomplete if it has less than 3 points
                        return geom.type === 'LineString' ||
                               (geom.type === 'Point');
                    });
                    setIsDrawing(hasIncompletePolygon);
                };

                draw.on('finish', handleFinish);
                draw.on('change', handleChange);

                console.log('[MultiSelect] Terra Draw started in polygon mode');
            } catch (error) {
                console.error('[MultiSelect] Error initializing Terra Draw:', error);
            }
        };

        // Small delay to ensure map is ready, then load Terra Draw
        const timeoutId = setTimeout(() => {
            initializeDraw();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            console.log('[MultiSelect] Cleaning up Terra Draw');
            if (drawRef.current) {
                try {
                    drawRef.current.stop();
                } catch (e) {
                    console.error('[MultiSelect] Error stopping draw:', e);
                }
                drawRef.current = null;
                setIsDrawing(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, isMultiSelectMode]);

    const clearSelection = useCallback(() => {
        if (!drawRef.current) return;

        console.log('[MultiSelect] Clearing selection polygon');
        const features = drawRef.current.getSnapshot();
        features.forEach(feature => {
            if (feature.id) {
                drawRef.current?.removeFeatures([feature.id]);
            }
        });
        setIsDrawing(false);
        setHasCompletedPolygon(false);
    }, [setIsDrawing, setHasCompletedPolygon]);

    const cancelSelection = useCallback(() => {
        if (!drawRef.current) return;

        console.log('[MultiSelect] Canceling selection');
        clearSelection();
        drawRef.current.setMode('select');
    }, [clearSelection]);

    const startNewSelection = useCallback(() => {
        if (!drawRef.current) return;

        console.log('[MultiSelect] Starting new selection');
        clearSelection();
        drawRef.current.setMode('polygon');
    }, [clearSelection]);

    return {
        clearSelection,
        cancelSelection,
        startNewSelection,
        draw: drawRef.current
    };
}
