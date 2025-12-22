/**
 * Utilities for building visible layer maps for feature info queries
 */
import type {
    LayerProps,
    WMSLayerProps,
    WFSLayerProps,
    FieldConfig,
    RelatedTable,
    LinkFields,
    RasterSource,
    ColorCodingRecordFunction,
} from '@/lib/types/mapping-types';

export interface VisibleLayerInfo {
    visible: boolean;
    groupLayerTitle: string;
    layerTitle: string;
    popupFields?: Record<string, FieldConfig>;
    relatedTables?: RelatedTable[];
    queryable?: boolean;
    linkFields?: LinkFields;
    customLayerParameters?: object | null;
    rasterSource?: RasterSource;
    schema?: string;
    layerCrs: string;
    colorCodingMap?: ColorCodingRecordFunction;
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

        const crs = (layer as WMSLayerProps | WFSLayerProps).crs || 'EPSG:4326';
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
                customLayerParameters: layer.type === 'wms' ? (layer as WMSLayerProps).customLayerParameters ?? undefined : undefined,
                rasterSource: sub.rasterSource,
                schema: sub.schema,
                layerCrs: layer.type === 'pmtiles' ? 'EPSG:4326' : crs,
                colorCodingMap: sub.colorCodingMap,
                wfsUrl: layer.type === 'wfs' ? (layer as WFSLayerProps).wfsUrl : undefined,
                typeName: layer.type === 'wfs' ? (layer as WFSLayerProps).typeName : undefined,
            };
        }
    };

    layers.forEach(processLayer);
    return result;
}
