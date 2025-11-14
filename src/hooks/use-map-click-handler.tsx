import { useCallback } from 'react';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import type { MapLibreMap } from '@/lib/types/map-types';

interface MapClickEvent {
    screenX: number;
    screenY: number;
}

interface UseMapClickHandlerProps {
    map: MapLibreMap;
    isSketching: boolean | (() => boolean);
    shouldIgnoreNextClick?: (() => boolean) | undefined;
    consumeIgnoreClick?: (() => void) | undefined;
    onPointClick: (point: MapPoint) => void;
    setVisibleLayersMap: (layers: any) => void;
    coordinateAdapter: CoordinateAdapter;
    layersConfig?: any; // MapLibre layer config to build visibleLayersMap
}

/**
 * Custom hook to handle MapLibre map click events.
 * Clears existing graphics, updates visible layers, converts screen coordinates to map coordinates,
 * and triggers a callback with the map point.
 */
export function useMapClickHandler({
    map,
    isSketching,
    shouldIgnoreNextClick,
    consumeIgnoreClick,
    onPointClick,
    setVisibleLayersMap,
    coordinateAdapter,
    layersConfig
}: UseMapClickHandlerProps) {

    const handleMapClick = useCallback((event: MapClickEvent) => {
        // Check if we should ignore this click (e.g., finishing a draw)
        if (shouldIgnoreNextClick?.()) {
            console.log('[MapClickHandler] Ignoring click - just finished drawing');
            consumeIgnoreClick?.();
            return;
        }

        const sketching = typeof isSketching === 'function' ? isSketching() : isSketching;
        console.log('[MapClickHandler] Click detected, isSketching:', sketching);
        if (sketching) {
            console.log('[MapClickHandler] Ignoring click - sketching in progress');
            return;
        }

        if (!map) {
            return;
        }

        // Build visibleLayersMap from layersConfig
        if (layersConfig) {
            const visibleLayersMap: Record<string, any> = {};

            const buildLayerMap = (layers: any[]) => {
                for (const layer of layers) {
                    if (layer.type === 'wms' && layer.sublayers) {
                        for (const sublayer of layer.sublayers) {
                            if (sublayer.name) {
                                // Check if the layer is actually visible on the map
                                let isVisible = layer.visible ?? true;

                                // Generate the same layer ID that was used when adding the layer
                                const sourceId = `wms-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                                const mapLayerId = `wms-layer-${sourceId}`;

                                const mapLayer = map.getLayer(mapLayerId);
                                if (mapLayer) {
                                    const visibility = map.getLayoutProperty(mapLayerId, 'visibility');
                                    isVisible = visibility !== 'none';
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
            setVisibleLayersMap(visibleLayersMap);
        }

        // Convert screen coordinates to map coordinates using adapter
        const screenPoint: ScreenPoint = {
            x: event.screenX,
            y: event.screenY
        };

        const mapPoint = coordinateAdapter.screenToMap(screenPoint, map);

        // Trigger the callback with the abstracted map point
        onPointClick(mapPoint);
    }, [map, isSketching, shouldIgnoreNextClick, consumeIgnoreClick, onPointClick, setVisibleLayersMap, coordinateAdapter, layersConfig]);

    return { handleMapClick };
}
