import { ExtendedGeometry } from "@/components/sidebar/filter/search-combobox";
import { findLayerByTitle } from "@/lib/map/utils";
import Extent from "@arcgis/core/geometry/Extent";
import WMSLayer from "@arcgis/core/layers/WMSLayer";
import { Feature, GeoJsonProperties } from "geojson";
import maplibregl from 'maplibre-gl';
import type {
    RasterLayerSpecification,
    RasterSourceSpecification,
    FilterSpecification
} from '@maplibre/maplibre-gl-style-spec';

export interface SearchResult {
    name: string,
    feature: Feature<ExtendedGeometry, GeoJsonProperties>,
}

interface RasterSourceWithMetadata extends RasterSourceSpecification {
    metadata?: Record<string, unknown>;
}

function hasStringSource(layer: unknown): layer is { source: string } {
    return (
        typeof layer === 'object' &&
        layer !== null &&
        'source' in layer &&
        typeof layer.source === 'string'
    );
}

function isRasterSource(source: unknown): source is RasterSourceSpecification {
    return (
        typeof source === 'object' &&
        source !== null &&
        'type' in source &&
        source.type === 'raster'
    );
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export const zoomToExtent = (xmin: number, ymin: number, xmax: number, ymax: number, view: __esri.SceneView | __esri.MapView, scale?: number) => {
    const extent = new Extent({
        xmin: xmin,
        ymin: ymin,
        xmax: xmax,
        ymax: ymax,
        spatialReference: { wkid: 4326 } // Assuming WGS 84 from the CRS
    });

    view.goTo({
        target: extent.expand(1.5),
        scale: scale ? scale : undefined,
    }).catch(error => {
        if (error.name !== "AbortError") {
            console.error("Error zooming to extent:", error);
        }
    });
}

export const findAndApplyWMSFilter = (
    mapInstance: __esri.Map | null | undefined,
    layerTitle: string,
    cqlFilter: string | null
) => {
    if (!mapInstance) return;

    const layer = findLayerByTitle(mapInstance, layerTitle);

    if (layer?.type === 'wms') {
        const wmsLayer = layer as WMSLayer;
        const newCustomParameters = { ...(wmsLayer.customParameters || {}) };

        if (cqlFilter) {
            newCustomParameters.cql_filter = cqlFilter;
        } else {
            delete newCustomParameters.cql_filter;
        }

        if (JSON.stringify(wmsLayer.customParameters) !== JSON.stringify(newCustomParameters)) {
            wmsLayer.customParameters = newCustomParameters;
            wmsLayer.refresh();
        }
    }
};

/**
 * Apply CQL filter to MapLibre WMS layers
 * Updates the WMS source URL to include the CQL_FILTER parameter
 *
 * @param map - MapLibre map instance
 * @param layerTitle - Title of the WMS layer
 * @param cqlFilter - CQL filter string (e.g., "field_name='value'")
 */
export const findAndApplyMapLibreWMSFilter = (
    map: maplibregl.Map | null | undefined,
    layerTitle: string,
    cqlFilter: string | null
) => {
    console.log(`[MapLibreWMSFilter] Called with:`, { layerTitle, cqlFilter, hasMap: !!map });

    if (!map) {
        console.warn(`[MapLibreWMSFilter] No map instance provided`);
        return;
    }

    const style = map.getStyle();
    if (!style?.layers || !style?.sources) {
        console.warn(`[MapLibreWMSFilter] No style layers or sources found`);
        return;
    }

    console.log(`[MapLibreWMSFilter] Searching for layer "${layerTitle}" in ${style.layers.length} layers`);

    // Find layer with matching title
    for (const layer of style.layers) {
        if (layer.type !== 'raster') continue;

        const metadata = layer.metadata;
        if (!metadata || typeof metadata !== 'object') continue;

        const title = 'title' in metadata ? metadata.title : undefined;
        if (typeof title !== 'string') continue;

        if (title === layerTitle) {
            console.log(`[MapLibreWMSFilter] Found matching layer:`, { id: layer.id, title });

            if (!hasStringSource(layer)) continue;
            const sourceId = layer.source;
            const source = style.sources[sourceId];

            if (!isRasterSource(source) || !source.tiles) continue;

            // Update the tiles URLs with new CQL filter
            const updatedTiles = source.tiles.map(tileUrl => {
                // Remove existing cql_filter and _t parameters
                let newUrl = tileUrl.replace(/[&?]cql_filter=[^&]*/g, '');
                newUrl = newUrl.replace(/[&?]_t=[^&]*/g, '');

                // Add new filter if provided
                if (cqlFilter) {
                    const separator = newUrl.includes('?') ? '&' : '?';
                    newUrl = `${newUrl}${separator}cql_filter=${encodeURIComponent(cqlFilter)}`;
                }

                // Add cache buster to force refresh
                const separator = newUrl.includes('?') ? '&' : '?';
                newUrl = `${newUrl}${separator}_t=${Date.now()}`;

                console.log(`[MapLibreWMSFilter] Updated tile URL:`, newUrl);
                return newUrl;
            });

            // Remove and re-add source and layer to force refresh
            const layerConfig: RasterLayerSpecification = {
                id: layer.id,
                type: 'raster',
                source: sourceId,
                layout: layer.layout,
                paint: layer.paint,
                metadata: layer.metadata,
            };

            let sourceMetadata: Record<string, unknown> | undefined = undefined;
            if ('metadata' in source && isRecordObject(source.metadata)) {
                sourceMetadata = source.metadata;
            }
            const sourceConfig: RasterSourceWithMetadata = {
                type: 'raster',
                tiles: updatedTiles,
                tileSize: source.tileSize || 512,
                scheme: source.scheme || 'xyz',
                minzoom: source.minzoom || 0,
                maxzoom: source.maxzoom || 22,
                metadata: sourceMetadata,
            };

            try {
                map.removeLayer(layer.id);
                map.removeSource(sourceId);
                map.addSource(sourceId, sourceConfig);
                map.addLayer(layerConfig);

                console.log(`[MapLibreWMSFilter] Applied filter to layer "${layerTitle}":`, cqlFilter || '(none)');
            } catch (error) {
                console.error(`[MapLibreWMSFilter] Error applying filter to layer "${layerTitle}":`, error);
            }

            break; // Found the layer, no need to continue
        }
    }
};

/**
 * Apply MapLibre filter expression to PMTiles/MVT layers
 * Converts CQL filter string to MapLibre filter expression and applies it to the layer
 *
 * @param map - MapLibre map instance
 * @param layerTitle - Title of the layer (from layer metadata)
 * @param cqlFilter - CQL filter string (e.g., "field_name='value'")
 */
export const findAndApplyPMTilesFilter = (
    map: maplibregl.Map | null | undefined,
    layerTitle: string,
    cqlFilter: string | null
) => {
    if (!map) return;

    const style = map.getStyle();
    if (!style?.layers) return;

    // Find all layers with matching title (could be fill, line, or symbol layers)
    for (const layer of style.layers) {
        const metadata = layer.metadata;
        if (!metadata || typeof metadata !== 'object') continue;

        const title = 'title' in metadata ? metadata.title : undefined;
        if (typeof title !== 'string') continue;

        if (title === layerTitle && (layer.type === 'fill' || layer.type === 'line' || layer.type === 'symbol')) {
            // Convert CQL filter to MapLibre expression
            const mapLibreFilter = convertCQLToMapLibreFilter(cqlFilter);

            if (mapLibreFilter) {
                map.setFilter(layer.id, mapLibreFilter);
            } else {
                map.setFilter(layer.id, null); // Clear filter
            }
        }
    }
};

/**
 * Convert CQL filter string to MapLibre filter expression
 * Supports simple equality and inequality patterns
 *
 * Examples:
 * - "field='value'" → ["==", ["get", "field"], "value"]
 * - "field!='value'" → ["!=", ["get", "field"], "value"]
 *
 * @param cqlFilter - CQL filter string
 * @returns MapLibre filter expression or null
 */
const convertCQLToMapLibreFilter = (cqlFilter: string | null): FilterSpecification | null => {
    if (!cqlFilter) return null;

    // Handle simple equality: field='value'
    const match = cqlFilter.match(/(\w+)\s*=\s*'([^']+)'/);
    if (match) {
        return ["==", ["get", match[1]], match[2]];
    }

    // Handle inequality: field!='value'
    const notMatch = cqlFilter.match(/(\w+)\s*!=\s*'([^']+)'/);
    if (notMatch) {
        return ["!=", ["get", notMatch[1]], notMatch[2]];
    }

    // Handle numeric comparisons if needed
    // field > 100
    const gtMatch = cqlFilter.match(/(\w+)\s*>\s*(\d+)/);
    if (gtMatch) {
        return [">", ["get", gtMatch[1]], parseInt(gtMatch[2], 10)];
    }

    return null;
};