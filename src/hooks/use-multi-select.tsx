import { useEffect, useRef, useCallback } from 'react';
import type { MapLibreMap } from '@/lib/types/map-types';
import { useMultiSelect } from '@/context/multi-select-context';
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
    const { isMultiSelectMode, selectionMode, setIsDrawing, setHasCompletedPolygon } = useMultiSelect();

    // Keep ref in sync with prop
    onPolygonCompleteRef.current = onPolygonComplete;

    useEffect(() => {
        // Only initialize Terra Draw in polygon mode
        const shouldDrawBeActive = map && isMultiSelectMode && selectionMode === 'polygon';

        if (!shouldDrawBeActive) {
            if (drawRef.current) {
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

                const handleFinish = (_id: string | number, context: { action: string; mode: string }) => {
                    if (context.mode === 'polygon' && context.action === 'draw') {
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
            } catch (error) {
                console.error('[MultiSelect] Error initializing Terra Draw:', error);
            }
        };

        let cleanedUp = false;

        // Check if style is already loaded, otherwise wait for event
        if (map.isStyleLoaded()) {
            initializeDraw();
        } else {
            const handleStyleLoad = () => {
                if (!cleanedUp) {
                    initializeDraw();
                }
            };
            map.once('style.load', handleStyleLoad);
        }

        return () => {
            cleanedUp = true;
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
    }, [map, isMultiSelectMode, selectionMode]);

    const clearSelection = useCallback(() => {
        if (!drawRef.current) return;

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

        clearSelection();
        drawRef.current.setMode('select');
    }, [clearSelection]);

    const startNewSelection = useCallback(() => {
        if (!drawRef.current) return;

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
