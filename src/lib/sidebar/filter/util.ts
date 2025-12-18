import { ExtendedGeometry } from "@/components/sidebar/filter/search-combobox";
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

export const zoomToExtent = (
    xmin: number,
    ymin: number,
    xmax: number,
    ymax: number,
    map: maplibregl.Map,
    scale?: number,
    onComplete?: () => void
) => {
    if (!map) {
        console.warn('No map instance provided to zoomToExtent');
        return;
    }

    // Set up one-time moveend listener if callback provided
    if (onComplete) {
        map.once('moveend', onComplete);
    }

    // If scale is provided, convert it to zoom level and use it as a target
    // Web Mercator scale to zoom level conversion: zoom ≈ log2(591657550.5 / scale)
    // 591657550.5 is the scale denominator at zoom level 0 for Web Mercator (EPSG:3857)
    if (scale) {
        const targetZoom = Math.log2(591657550.5 / scale);

        // For points with a scale, we want to zoom to that specific level
        // First fit to the bounds, then zoom to the target level
        map.fitBounds(
            [[xmin, ymin], [xmax, ymax]] as [[number, number], [number, number]],
            {
                padding: 100,
                zoom: targetZoom,
                duration: 500
            }
        );
    } else {
        // For polygons/lines without a scale, just fit to bounds with padding
        map.fitBounds(
            [[xmin, ymin], [xmax, ymax]] as [[number, number], [number, number]],
            {
                padding: 50,
                duration: 500
            }
        );
    }
}

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
    if (!map) {
        console.warn(`[MapLibreWMSFilter] No map instance provided`);
        return;
    }

    const style = map.getStyle();
    if (!style?.layers || !style?.sources) {
        console.warn(`[MapLibreWMSFilter] No style layers or sources found`);
        return;
    }

    // Find layer with matching title
    for (const layer of style.layers) {
        if (layer.type !== 'raster') continue;

        const metadata = layer.metadata;
        if (!metadata || typeof metadata !== 'object') continue;

        const title = 'title' in metadata ? metadata.title : undefined;
        if (typeof title !== 'string') continue;

        if (title === layerTitle) {

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
            } catch (error) {
                console.error(`[MapLibreWMSFilter] Error applying filter to layer "${layerTitle}":`, error);
            }

            break; // Found the layer, no need to continue
        }
    }
};

// Store original filters for layers so we can restore/combine with them
const originalLayerFilters = new Map<string, FilterSpecification | null>();

/**
 * Apply MapLibre filter expression to PMTiles/MVT layers
 * Converts CQL filter string to MapLibre filter expression and applies it to the layer
 * Preserves and combines with existing style filters (e.g., for color categorization)
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
    if (!map) {
        return;
    }

    const style = map.getStyle();
    if (!style?.layers) {
        return;
    }

    // Convert CQL filter to MapLibre expression
    const userFilter = convertCQLToMapLibreFilter(cqlFilter);

    let matchedLayers = 0;

    // Find all layers with matching title (could be fill, line, circle, or symbol layers)
    for (const layer of style.layers) {
        const metadata = layer.metadata;
        if (!metadata || typeof metadata !== 'object') continue;

        const title = 'title' in metadata ? metadata.title : undefined;
        if (typeof title !== 'string') continue;

        if (title === layerTitle && (layer.type === 'fill' || layer.type === 'line' || layer.type === 'symbol' || layer.type === 'circle')) {
            matchedLayers++;

            // Store original filter if not already stored
            if (!originalLayerFilters.has(layer.id)) {
                originalLayerFilters.set(layer.id, layer.filter as FilterSpecification | null ?? null);
            }

            const originalFilter = originalLayerFilters.get(layer.id);

            if (userFilter) {
                if (originalFilter) {
                    // Combine original filter with user filter using "all"
                    const combinedFilter = ["all", originalFilter, userFilter] as FilterSpecification;
                    map.setFilter(layer.id, combinedFilter);
                } else {
                    map.setFilter(layer.id, userFilter);
                }
            } else {
                // No user filter - restore original filter
                map.setFilter(layer.id, originalFilter ?? null);
            }
        }
    }

};

/**
 * Convert CQL filter string to MapLibre filter expression (legacy format)
 * Uses legacy filter format for compatibility with existing layer filters
 *
 * Examples:
 * - "field='value'" → ["==", "field", "value"]
 * - "field!='value'" → ["!=", "field", "value"]
 * - "hascore = 'True'" → ["==", "hascore", "True"]
 * - "field IS NOT NULL" → ["has", "field"]
 * - "a='1' AND b='2'" → ["all", ["==", ...], ["==", ...]]
 *
 * @param cqlFilter - CQL filter string
 * @returns MapLibre filter expression (legacy format) or null
 */
const convertCQLToMapLibreFilter = (cqlFilter: string | null): FilterSpecification | null => {
    if (!cqlFilter) return null;

    // Split by AND (case insensitive) and process each part
    const parts = cqlFilter.split(/\s+AND\s+/i).map(p => p.trim());
    const conditions: FilterSpecification[] = [];

    for (const part of parts) {
        // Remove outer parentheses if present
        const cleanPart = part.replace(/^\(+|\)+$/g, '').trim();

        // Handle IS NOT NULL: field IS NOT NULL → ["has", "field"]
        const isNotNullMatch = cleanPart.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
        if (isNotNullMatch) {
            conditions.push(["has", isNotNullMatch[1]] as FilterSpecification);
            continue;
        }

        // Handle equality with string value: field='value' or field = 'value'
        const eqMatch = cleanPart.match(/(\w+)\s*=\s*'([^']+)'/);
        if (eqMatch) {
            const fieldName = eqMatch[1];
            const value = eqMatch[2];

            // has_las is stored as Boolean in PMTiles, hascore as String
            if (fieldName === 'has_las') {
                conditions.push(["==", fieldName, value === 'True'] as FilterSpecification);
            } else {
                // Keep string values as-is for other fields (legacy format)
                conditions.push(["==", fieldName, value] as FilterSpecification);
            }
            continue;
        }

        // Handle inequality: field!='value'
        const notMatch = cleanPart.match(/(\w+)\s*!=\s*'([^']+)'/);
        if (notMatch) {
            conditions.push(["!=", notMatch[1], notMatch[2]] as FilterSpecification);
            continue;
        }

        // Handle numeric comparisons: field > 100
        const gtMatch = cleanPart.match(/(\w+)\s*>\s*(\d+)/);
        if (gtMatch) {
            conditions.push([">", gtMatch[1], parseInt(gtMatch[2], 10)] as FilterSpecification);
            continue;
        }
    }

    if (conditions.length === 0) return null;
    if (conditions.length === 1) return conditions[0];
    return ["all", ...conditions] as FilterSpecification;
};

/**
 * Apply filter to a layer - works for both WMS and PMTiles layers
 * Automatically detects layer type and uses appropriate method
 *
 * @param map - MapLibre map instance
 * @param layerTitle - Title of the layer
 * @param cqlFilter - CQL filter string
 */
export const applyLayerFilter = (
    map: maplibregl.Map | null | undefined,
    layerTitle: string,
    cqlFilter: string | null
) => {
    if (!map) {
        return;
    }

    const style = map.getStyle();
    if (!style?.layers) {
        return;
    }

    // First check if this is a vector layer (PMTiles/MVT)
    let foundVectorLayer = false;
    for (const layer of style.layers) {
        const metadata = layer.metadata;
        if (!metadata || typeof metadata !== 'object') continue;

        const title = 'title' in metadata ? metadata.title : undefined;
        if (typeof title !== 'string' || title !== layerTitle) continue;

        // Check if it's a vector layer type
        if (layer.type === 'fill' || layer.type === 'line' || layer.type === 'symbol' || layer.type === 'circle') {
            foundVectorLayer = true;
            break;
        }
    }

    if (foundVectorLayer) {
        findAndApplyPMTilesFilter(map, layerTitle, cqlFilter);
    } else {
        findAndApplyMapLibreWMSFilter(map, layerTitle, cqlFilter);
    }
};