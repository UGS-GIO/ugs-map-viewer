/**
 * Utilities for building visible layer maps for feature info queries
 */
import type {
    LayerProps,
    FieldConfig,
    RelatedTable,
    LinkFields,
    RasterSource,
    ColorCodingRecordFunction,
    ColorCodingMode,
} from '@/lib/types/mapping-types';
import { isWMSLayer, isWFSLayer } from '@/lib/map/layer-utils';

export interface VisibleLayerInfo {
    visible: boolean;
    groupLayerTitle: string;
    layerTitle: string;
    popupFields?: Record<string, FieldConfig>;
    relatedTables?: RelatedTable[];
    queryable?: boolean;
    linkFields?: LinkFields;
    customLayerParameters?: Record<string, string> | null;
    rasterSource?: RasterSource;
    schema?: string;
    layerCrs: string;
    colorCodingMap?: ColorCodingRecordFunction;
    colorCodingMode?: ColorCodingMode;
    wfsUrl?: string;
    typeName?: string;
}

export type VisibleLayersMap = Record<string, VisibleLayerInfo>;

/**
 * Builds a flat map of queryable layers from layer config.
 * Uses visibility from the layer config (which should already reflect URL state).
 */
export function buildVisibleLayersMap(layers: LayerProps[]): VisibleLayersMap {
    const result: VisibleLayersMap = {};

    const processLayer = (layer: LayerProps): void => {
        const isVisible = layer.visible ?? true;
        const title = layer.title || '';

        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            layer.layers.forEach(processLayer);
            return;
        }

        if (!('sublayers' in layer) || !layer.sublayers) return;

        const wmsLayer = isWMSLayer(layer) ? layer : undefined;
        const wfsLayer = isWFSLayer(layer) ? layer : undefined;
        const crs = (wmsLayer?.crs ?? wfsLayer?.crs) || 'EPSG:4326';
        const prefix = layer.type === 'wms' ? '' : `${layer.type}:`;

        for (const sub of layer.sublayers) {
            if (!sub.name) continue;

            result[`${prefix}${sub.name}`] = {
                visible: isVisible,
                groupLayerTitle: title,
                layerTitle: title || sub.name,
                popupFields: sub.popupFields,
                relatedTables: sub.relatedTables,
                queryable: sub.queryable ?? true,
                linkFields: sub.linkFields,
                customLayerParameters: wmsLayer?.customLayerParameters ?? undefined,
                rasterSource: sub.rasterSource,
                schema: sub.schema,
                layerCrs: layer.type === 'pmtiles' ? 'EPSG:4326' : crs,
                colorCodingMap: sub.colorCodingMap,
                colorCodingMode: sub.colorCodingMode,
                wfsUrl: wfsLayer?.wfsUrl,
                typeName: wfsLayer?.typeName,
            };
        }
    };

    layers.forEach(processLayer);
    return result;
}
