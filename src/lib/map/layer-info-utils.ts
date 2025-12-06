/**
 * Utilities for building visible layer maps for feature info queries
 */
import type { LayerProps, WMSLayerProps, WFSLayerProps, PMTilesLayerProps } from '@/lib/types/mapping-types';
import type { MapLibreMap } from '@/lib/types/map-types';

export interface VisibleLayerInfo {
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
    colorCodingMap?: unknown;
    // WFS-specific properties for server-side queries
    wfsUrl?: string;
    typeName?: string;
}

export type VisibleLayersMap = Record<string, VisibleLayerInfo>;

/**
 * Checks actual visibility of a layer on the map by ID prefix
 */
function checkMapLayerVisibility(
    map: MapLibreMap,
    layerIdPrefix: string,
    defaultVisibility: boolean
): boolean {
    const style = map.getStyle();
    if (style?.layers) {
        for (const mapLayer of style.layers) {
            if (mapLayer.id.startsWith(layerIdPrefix)) {
                const visibility = map.getLayoutProperty(mapLayer.id, 'visibility');
                return visibility !== 'none';
            }
        }
    }
    return defaultVisibility;
}

/**
 * Builds a map of visible layers from layer config.
 *
 * @param layers - The layer configuration array
 * @param map - Optional MapLibre map instance. If provided, checks actual layer visibility.
 *              If null, uses visibility from config (useful for initial load before map is ready).
 * @returns Map of layer keys to their info
 */
export function buildVisibleLayersMap(
    layers: LayerProps[],
    map?: MapLibreMap | null
): VisibleLayersMap {
    const result: VisibleLayersMap = {};

    const processLayers = (layerList: LayerProps[]): void => {
        for (const layer of layerList) {
            if (layer.type === 'wms' && 'sublayers' in layer && layer.sublayers) {
                const wmsLayer = layer as WMSLayerProps;
                for (const sublayer of wmsLayer.sublayers) {
                    if (sublayer.name) {
                        let isVisible = layer.visible ?? true;

                        // Check actual map visibility if map is available
                        if (map) {
                            const sourceId = `wms-${wmsLayer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                            const mapLayerId = `wms-layer-${sourceId}`;
                            const mapLayer = map.getLayer(mapLayerId);
                            if (mapLayer) {
                                const visibility = map.getLayoutProperty(mapLayerId, 'visibility');
                                isVisible = visibility !== 'none';
                            }
                        }

                        result[sublayer.name] = {
                            visible: isVisible,
                            groupLayerTitle: wmsLayer.title || '',
                            layerTitle: wmsLayer.title || sublayer.name,
                            popupFields: sublayer.popupFields,
                            relatedTables: sublayer.relatedTables,
                            queryable: sublayer.queryable ?? true,
                            linkFields: sublayer.linkFields,
                            customLayerParameters: wmsLayer.customLayerParameters,
                            rasterSource: sublayer.rasterSource,
                            schema: sublayer.schema,
                            layerCrs: wmsLayer.crs || 'EPSG:3857',
                            colorCodingMap: sublayer.colorCodingMap,
                        };
                    }
                }
            } else if (layer.type === 'wfs' && 'sublayers' in layer && layer.sublayers) {
                const wfsLayer = layer as WFSLayerProps;
                for (const sublayer of layer.sublayers) {
                    if (sublayer.name) {
                        let isVisible = layer.visible ?? true;

                        // Check actual map visibility if map is available
                        if (map) {
                            const sourceId = `wfs-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                            isVisible = checkMapLayerVisibility(map, sourceId, isVisible);
                        }

                        result[`wfs:${sublayer.name}`] = {
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
                            layerCrs: wfsLayer.crs || 'EPSG:4326',
                            colorCodingMap: sublayer.colorCodingMap,
                            // WFS-specific properties for server-side queries
                            wfsUrl: wfsLayer.wfsUrl,
                            typeName: wfsLayer.typeName,
                        };
                    }
                }
            } else if (layer.type === 'pmtiles' && 'sublayers' in layer && layer.sublayers) {
                // Cast for future use (e.g., pmtiles-specific properties)
                const pmtilesLayer = layer as PMTilesLayerProps;
                void pmtilesLayer; // Reserved for future pmtiles-specific properties
                for (const sublayer of layer.sublayers) {
                    if (sublayer.name) {
                        let isVisible = layer.visible ?? true;

                        // Check actual map visibility if map is available
                        if (map) {
                            const sourceId = `pmtiles-${layer.title || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                            isVisible = checkMapLayerVisibility(map, sourceId, isVisible);
                        }

                        result[`pmtiles:${sublayer.name}`] = {
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
                            colorCodingMap: sublayer.colorCodingMap,
                        };
                    }
                }
            } else if (layer.type === 'group' && 'layers' in layer && layer.layers) {
                processLayers(layer.layers);
            }
        }
    };

    processLayers(layers);
    return result;
}
