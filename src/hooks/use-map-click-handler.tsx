import { useCallback } from 'react';
import { clearGraphics } from '@/lib/map/highlight-utils';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';

interface MapClickEvent {
    screenX: number;
    screenY: number;
}

interface UseMapClickHandlerProps {
    view: __esri.MapView | __esri.SceneView | undefined;
    map?: any; // MapLibre map instance
    isSketching: boolean;
    onPointClick: (point: MapPoint) => void;
    getVisibleLayers?: (params: { view: __esri.MapView | __esri.SceneView }) => any;
    setVisibleLayersMap: (layers: any) => void;
    coordinateAdapter: CoordinateAdapter;
    layersConfig?: any; // For MapLibre to build visibleLayersMap
}

/**
 * Custom hook to handle map click events.
 * Clears existing graphics, updates visible layers, converts screen coordinates to map coordinates,
 * and triggers a callback with the map point.
 * Now uses abstracted coordinate system for better portability.
 * @param view - The ArcGIS MapView or SceneView instance.
 * @param isSketching - Boolean indicating if sketching mode is active.
 * @param onPointClick - Callback function to be called with the map point on click.
 * @param getVisibleLayers - Function to retrieve currently visible layers from the view.
 * @param setVisibleLayersMap - Function to update the state of visible layers.
 * @param coordinateAdapter - Adapter for coordinate system operations.
 * @returns An object containing the handleMapClick function.
 */
export function useMapClickHandler({
    view,
    map,
    isSketching,
    onPointClick,
    getVisibleLayers,
    setVisibleLayersMap,
    coordinateAdapter,
    layersConfig
}: UseMapClickHandlerProps) {

    const handleMapClick = useCallback((event: MapClickEvent) => {
        if (isSketching) {
            return;
        }

        // For ArcGIS, we need a view
        if (!view && !map) {
            return;
        }

        // Clear existing graphics if using ArcGIS (MapLibre doesn't have graphics)
        if (view && getVisibleLayers) {
            clearGraphics(view);

            // Update visible layers state
            const layers = getVisibleLayers({ view });
            setVisibleLayersMap(layers.layerVisibilityMap);
        } else if (map && layersConfig) {
            // For MapLibre, build visibleLayersMap from layersConfig
            const visibleLayersMap: Record<string, any> = {};

            // Get all MapLibre layers for debugging
            const allMapLibreLayers = map.getStyle().layers || [];
            const wmsLayerIds = allMapLibreLayers.filter((l: any) => l.id.includes('wms')).map((l: any) => l.id);
            console.log('[MapClickHandler] MapLibre WMS layers:', wmsLayerIds);

            const buildLayerMap = (layers: any[]) => {
                for (const layer of layers) {
                    if (layer.type === 'wms' && layer.sublayers) {
                        for (const sublayer of layer.sublayers) {
                            if (sublayer.name) {
                                // For MapLibre, check if the layer is actually visible on the map
                                let isVisible = layer.visible ?? true;

                                // Generate the same layer ID that was used when adding the layer
                                const sourceId = `wms-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                                const mapLayerId = `wms-layer-${sourceId}`;

                                const mapLayer = map.getLayer(mapLayerId);
                                if (mapLayer) {
                                    const visibility = map.getLayoutProperty(mapLayerId, 'visibility');
                                    isVisible = visibility !== 'none';
                                    console.log('[MapClickHandler] Layer found in MapLibre:', { name: sublayer.name, title: layer.title, mapLayerId, visibility, isVisible, configVisible: layer.visible });
                                } else {
                                    console.log('[MapClickHandler] Layer NOT found in MapLibre:', { name: sublayer.name, title: layer.title, mapLayerId, configVisible: layer.visible });
                                }

                                visibleLayersMap[sublayer.name] = {
                                    visible: isVisible,
                                    groupLayerTitle: layer.title || '',
                                    layerTitle: layer.title || sublayer.name,
                                    popupFields: sublayer.popupFields,
                                    relatedTables: sublayer.relatedTables,
                                    queryable: sublayer.queryable ?? true,
                                    linkFields: sublayer.linkFields,
                                    customLayerParameters: layer.customLayerParameters,
                                    rasterSource: sublayer.rasterSource,
                                    schema: sublayer.schema,
                                    layerCrs: (layer as any).crs || 'EPSG:3857',
                                };
                                if (isVisible) {
                                    console.log('[MapClickHandler] VISIBLE layer:', { name: sublayer.name, title: layer.title, mapLayerId });
                                }
                            }
                        }
                    } else if (layer.type === 'group' && layer.layers) {
                        buildLayerMap(layer.layers);
                    }
                }
            };

            if (Array.isArray(layersConfig)) {
                buildLayerMap(layersConfig);
            }
            console.log('[MapClickHandler] Built visibleLayersMap:', Object.entries(visibleLayersMap).map(([k, v]) => ({ key: k, visible: v.visible, title: v.layerTitle })));
            setVisibleLayersMap(visibleLayersMap);
        }

        // Convert screen coordinates to map coordinates using adapter
        const screenPoint: ScreenPoint = {
            x: event.screenX,
            y: event.screenY
        };

        const mapPoint = coordinateAdapter.screenToMap(screenPoint, view || map);

        // Trigger the callback with the abstracted map point
        onPointClick(mapPoint);
    }, [view, map, isSketching, onPointClick, getVisibleLayers, setVisibleLayersMap, coordinateAdapter, layersConfig]);

    return { handleMapClick };
}