import { useCallback } from 'react';
import type { MapPoint, ScreenPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import type { MapLibreMap } from '@/lib/types/map-types';
import type { LayerProps } from '@/lib/types/mapping-types';

interface MapClickEvent {
    screenX: number;
    screenY: number;
}

interface VisibleLayerInfo {
    visible: boolean;
    groupLayerTitle: string;
    layerTitle: string;
    popupFields?: unknown;
    relatedTables?: unknown;
    queryable?: boolean;
    linkFields?: unknown;
    customLayerParameters?: unknown;
    rasterSource?: unknown;
    schema?: string;
    layerCrs: string;
}

interface UseMapClickHandlerProps {
    map: MapLibreMap;
    isSketching: boolean | (() => boolean);
    shouldIgnoreNextClick?: (() => boolean) | undefined;
    consumeIgnoreClick?: (() => void) | undefined;
    onPointClick: (point: MapPoint) => void;
    setVisibleLayersMap: (layers: Record<string, VisibleLayerInfo>) => void;
    coordinateAdapter: CoordinateAdapter;
    layersConfig?: LayerProps[] | null;
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
            const visibleLayersMap: Record<string, VisibleLayerInfo> = {};

            const buildLayerMap = (layers: LayerProps[]): void => {
                for (const layer of layers) {
                    if (layer.type === 'wms' && 'sublayers' in layer && layer.sublayers) {
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
                                    customLayerParameters: ('customLayerParameters' in layer ? layer.customLayerParameters : undefined) as Record<string, unknown> | null | undefined,
                                    rasterSource: sublayer.rasterSource,
                                    schema: sublayer.schema,
                                    layerCrs: ('crs' in layer ? layer.crs : undefined) || 'EPSG:3857',
                                };
                            }
                        }
                    } else if (layer.type === 'pmtiles' && 'sublayers' in layer && layer.sublayers) {
                        // Handle PMTiles layers
                        for (const sublayer of layer.sublayers) {
                            if (sublayer.name) {
                                // Check if the PMTiles layer is visible
                                let isVisible = layer.visible ?? true;
                                const sourceId = `pmtiles-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();

                                // Check any PMTiles layer for visibility
                                const style = map.getStyle();
                                if (style?.layers) {
                                    for (const mapLayer of style.layers) {
                                        if (mapLayer.id.startsWith(sourceId)) {
                                            const visibility = map.getLayoutProperty(mapLayer.id, 'visibility');
                                            isVisible = visibility !== 'none';
                                            break;
                                        }
                                    }
                                }

                                visibleLayersMap[`pmtiles:${sublayer.name}`] = {
                                    visible: isVisible,
                                    groupLayerTitle: layer.title || '',
                                    layerTitle: layer.title || sublayer.name,
                                    popupFields: sublayer.popupFields,
                                    relatedTables: sublayer.relatedTables,
                                    queryable: sublayer.queryable ?? true,
                                    linkFields: sublayer.linkFields,
                                    customLayerParameters: undefined,
                                    rasterSource: sublayer.rasterSource,
                                    schema: sublayer.schema,
                                    layerCrs: 'EPSG:4326', // PMTiles are always in WGS84
                                };
                            }
                        }
                    } else if (layer.type === 'wfs' && 'sublayers' in layer && layer.sublayers) {
                        // Handle WFS layers
                        for (const sublayer of layer.sublayers) {
                            if (sublayer.name) {
                                // Check if the WFS layer is visible
                                let isVisible = layer.visible ?? true;
                                const sourceId = `wfs-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();

                                // Check any WFS layer for visibility
                                const style = map.getStyle();
                                if (style?.layers) {
                                    for (const mapLayer of style.layers) {
                                        if (mapLayer.id.startsWith(sourceId)) {
                                            const visibility = map.getLayoutProperty(mapLayer.id, 'visibility');
                                            isVisible = visibility !== 'none';
                                            break;
                                        }
                                    }
                                }

                                visibleLayersMap[`wfs:${sublayer.name}`] = {
                                    visible: isVisible,
                                    groupLayerTitle: layer.title || '',
                                    layerTitle: layer.title || sublayer.name,
                                    popupFields: sublayer.popupFields,
                                    relatedTables: sublayer.relatedTables,
                                    queryable: sublayer.queryable ?? true,
                                    linkFields: sublayer.linkFields,
                                    customLayerParameters: undefined,
                                    rasterSource: sublayer.rasterSource,
                                    schema: sublayer.schema,
                                    layerCrs: ('crs' in layer ? layer.crs : undefined) || 'EPSG:4326',
                                };
                            }
                        }
                    } else if (layer.type === 'group' && 'layers' in layer && layer.layers) {
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
