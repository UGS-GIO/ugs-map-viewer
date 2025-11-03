import { useEffect, useRef, useState } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface UseMapLibreDrawProps {
    map: any; // maplibre-gl.Map
    onDrawComplete?: (geometry: any) => void;
    onDrawActive?: (isActive: boolean) => void;
}

// MapLibre 3.x compatibility fix - update CSS class names
function fixMapLibreDrawCompatibility() {
    const constants = (MapboxDraw as any).constants;
    if (constants) {
        console.log('[MapLibreDraw] Applying MapLibre compatibility fixes');
        // Update control classes
        if (constants.classes) {
            constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
            constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
            constants.classes.PREDEFINED_PREFIX = 'mapbox-gl-draw_';
            constants.classes.HIDDEN = 'maplibregl-ctrl-hidden';
            constants.classes.TOUCHABLE_INACTIVE = 'maplibregl-touch-target';
            constants.classes.TOUCHABLE_ACTIVE = 'maplibregl-touch-target-active';
        }
        // Update canvas class
        if (constants.CANVAS_CLASS_NAME !== undefined) {
            constants.CANVAS_CLASS_NAME = 'maplibregl-canvas';
        }
        // Update attribution class
        if (constants.ATTRIBUTION_CLASS_NAME !== undefined) {
            constants.ATTRIBUTION_CLASS_NAME = 'maplibregl-ctrl-attrib';
        }
    }
}

export function useMapLibreDraw({ map, onDrawComplete, onDrawActive }: UseMapLibreDrawProps) {
    const drawRef = useRef<MapboxDraw | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (!map || typeof map.addControl !== 'function') {
            console.log('[MapLibreDraw] Map not ready or missing addControl method');
            return;
        }

        // Initialize the draw plugin
        console.log('[MapLibreDraw] Initializing draw plugin');

        // Apply MapLibre compatibility fixes first
        fixMapLibreDrawCompatibility();

        const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true
            },
            defaultMode: 'simple_select',
            styles: [
                // Outline
                {
                    id: 'gl-draw-polygon-fill',
                    type: 'fill',
                    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    paint: {
                        'fill-color': '#D20C0C',
                        'fill-opacity': 0.1
                    }
                },
                // Polygon outline stroke
                {
                    id: 'gl-draw-polygon-stroke-active',
                    type: 'line',
                    filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    layout: {
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    paint: {
                        'line-color': '#D20C0C',
                        'line-dasharray': [0.2, 2],
                        'line-width': 2
                    }
                },
                // Vertex point halos
                {
                    id: 'gl-draw-polygon-and-line-vertex-halo-active',
                    type: 'circle',
                    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
                    paint: {
                        'circle-radius': 5,
                        'circle-color': '#FFF'
                    }
                },
                // Vertex points
                {
                    id: 'gl-draw-polygon-and-line-vertex-active',
                    type: 'circle',
                    filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
                    paint: {
                        'circle-radius': 3,
                        'circle-color': '#D20C0C'
                    }
                }
            ]
        });

        map.addControl(draw);
        drawRef.current = draw;

        // Handle draw events
        const handleDrawCreate = () => {
            const data = draw.getAll();
            if (data.features.length > 0) {
                const feature = data.features[data.features.length - 1];
                console.log('[MapLibreDraw] Draw create event:', feature);
            }
        };

        const handleDrawUpdate = () => {
            const data = draw.getAll();
            console.log('[MapLibreDraw] Draw update event:', data);
        };

        const handleDrawSelectionChange = () => {
            const data = draw.getAll();
            console.log('[MapLibreDraw] Selection change:', data);
        };

        const handleKeyDown = (_e: KeyboardEvent) => {
            // Keyboard handling will be done in the component
            // This is just a placeholder
        };

        map.on('draw.create', handleDrawCreate);
        map.on('draw.update', handleDrawUpdate);
        map.on('draw.selectionchange', handleDrawSelectionChange);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            map?.off?.('draw.create', handleDrawCreate);
            map?.off?.('draw.update', handleDrawUpdate);
            map?.off?.('draw.selectionchange', handleDrawSelectionChange);
            window.removeEventListener('keydown', handleKeyDown);

            if (drawRef.current && map?.removeControl) {
                map.removeControl(drawRef.current);
                drawRef.current = null;
            }
        };
    }, [map, isDrawing, onDrawComplete, onDrawActive]);

    const startPolygonDraw = () => {
        console.log('[MapLibreDraw] startPolygonDraw called, drawRef:', !!drawRef.current);
        if (!drawRef.current) {
            console.warn('[MapLibreDraw] Draw not initialized yet');
            return;
        }

        // Change to draw mode
        console.log('[MapLibreDraw] Changing to draw_polygon mode');
        drawRef.current.changeMode('draw_polygon');
        setIsDrawing(true);
        onDrawActive?.(true);
    };

    const completeDraw = () => {
        if (!drawRef.current) return;

        const data = drawRef.current.getAll();
        if (data.features.length === 0) return;

        const feature = data.features[0];
        console.log('[MapLibreDraw] completeDraw - Feature:', feature);

        // Convert GeoJSON geometry to expected format
        if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0] as Array<[number, number]>;
            const geometry = {
                type: 'polygon',
                rings: coords.map((coord: [number, number]) => [coord[0], coord[1]])
            };

            console.log('[MapLibreDraw] completeDraw - Geometry:', geometry);
            onDrawComplete?.(geometry);

            // Reset draw state
            drawRef.current.changeMode('simple_select');
            setIsDrawing(false);
            onDrawActive?.(false);
        }
    };

    const cancelDraw = () => {
        if (!drawRef.current) return;

        // Clear all features
        const allFeatures = drawRef.current.getAll();
        drawRef.current.delete(allFeatures.features.map((f: any) => f.id as string));

        drawRef.current.changeMode('simple_select');
        setIsDrawing(false);
        onDrawActive?.(false);
    };

    const resetDraw = () => {
        if (!drawRef.current) return;

        // Clear all features and reset mode
        const allFeatures = drawRef.current.getAll();
        drawRef.current.delete(allFeatures.features.map((f: any) => f.id as string));
        drawRef.current.changeMode('simple_select');
        setIsDrawing(false);
        onDrawActive?.(false);
    };

    return {
        startPolygonDraw,
        completeDraw,
        cancelDraw,
        resetDraw,
        isDrawing,
        draw: drawRef.current
    };
}
