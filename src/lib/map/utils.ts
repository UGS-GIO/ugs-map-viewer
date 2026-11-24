import { ExtendedFeature } from '@/components/maps/popups/types';
import { convertBbox, convertCoordinate, convertGeometryToWGS84 } from '@/lib/map/conversion-utils';
import type { Geometry } from 'geojson';
import { LngLat, LngLatBounds } from 'maplibre-gl';
import { bbox as turfBbox } from '@turf/bbox';
import type { MapLibreMap } from '@/lib/types/map-types';
import { OPACITY_PROPS, scaledOpacityPaint } from '@/lib/map/scale-opacity';

// Re-export type guards from their canonical location
export { isWMSLayer, isGroupLayer } from '@/lib/map/layer-utils';

export const DEFAULT_ZOOM_TO_FEATURE_MAX_ZOOM = 14;

export interface ZoomToFeatureOptions {
    maxZoom?: number;
    padding?: number;
    animate?: boolean;
}

/**
 * Create a bounding box around a point with a given radius buffer, correct at any latitude.
 * MapLibre's LngLatBounds.fromLngLat instead of @turf/buffer, which pulled ~50 KB into the first load.
 *
 * @param coords - [lng, lat] coordinates in WGS84
 * @param radiusKm - Buffer radius in kilometers (default: 0.1 = 100m)
 * @returns [minX, minY, maxX, maxY] bbox or null if the coordinates are invalid
 */
export function createPointBufferBbox(
    coords: [number, number],
    radiusKm: number = 0.1
): [number, number, number, number] | null {
    try {
        const [[minX, minY], [maxX, maxY]] = LngLatBounds.fromLngLat(new LngLat(coords[0], coords[1]), radiusKm * 1000).toArray();
        return [minX, minY, maxX, maxY];
    } catch (error) {
        console.warn('[createPointBufferBbox] Error buffering point:', error);
    }
    return null;
}

interface RenderedLayer { id: string; type: string; baseOpacity?: Record<string, unknown> }

/** All rendered layers whose viewer `metadata.title` matches. */

function findRenderedLayersByTitle(mapInstance: MapLibreMap, title: string): RenderedLayer[] {
    const matches: RenderedLayer[] = [];
    for (const layer of mapInstance.getStyle()?.layers ?? []) {
        const md = layer.metadata as { title?: unknown; baseOpacity?: Record<string, unknown> } | undefined;
        if (md?.title === title) matches.push({ id: layer.id, type: layer.type, baseOpacity: md.baseOpacity });
    }
    return matches;
}

export function findLayerByTitle(mapInstance: MapLibreMap, title: string): MapLibreLayerProxy | null {
    // Return a proxy object that allows setting opacity and visibility
    // The proxy intercepts property assignments and applies them to all matching MapLibre layers
    const layers = findRenderedLayersByTitle(mapInstance, title);
    return layers.length > 0 ? new MapLibreLayerProxy(mapInstance, layers) : null;
}

/**
 * Proxy object for MapLibre layers to allow setting opacity and visibility
 * like ArcGIS layers, while applying changes to all matching MapLibre sublayers.
 */
class MapLibreLayerProxy {
    private map: MapLibreMap;
    private layers: RenderedLayer[];
    private layerId: string;
    private _opacity: number;
    private _layerType: string;

    constructor(map: MapLibreMap, layers: RenderedLayer[]) {
        this.map = map;
        this.layers = layers;
        this.layerId = layers[0].id;
        this._layerType = layers[0].type || 'raster';
        this._opacity = this.readCurrentOpacity();
    }

    private readCurrentOpacity(): number {
        if (!this.map) return 1;
        try {
            const opacityProp = OPACITY_PROPS[this._layerType]?.[0] ?? 'raster-opacity';
            const currentOpacity = this.map.getPaintProperty(this.layerId, opacityProp);
            return typeof currentOpacity === 'number' ? currentOpacity : 1;
        } catch {
            return 1;
        }
    }

    get opacity(): number {
        return this._opacity;
    }

    set opacity(value: number) {
        this._opacity = value;
        if (!this.map || typeof this.map.setPaintProperty !== 'function') return;
        // Circle strokes and symbol text track the fill; PMTiles sublayers scale from their authored opacity.
        for (const { id, type, baseOpacity } of this.layers) {
            for (const [prop, val] of scaledOpacityPaint(baseOpacity, type, value)) {
                this.map.setPaintProperty(id, prop, val);
            }
        }
    }

    get visible(): boolean {
        if (!this.map) return true;
        const visibility = this.map.getLayoutProperty(this.layerId, 'visibility');
        return visibility !== 'none';
    }

    set visible(value: boolean) {
        if (this.map && typeof this.map.setLayoutProperty === 'function') {
            const vis = value ? 'visible' : 'none';
            for (const { id } of this.layers) {
                this.map.setLayoutProperty(id, 'visibility', vis);
            }
        }
    }

    get id(): string {
        return this.layerId;
    }

    get type(): string {
        return this._layerType;
    }
}


/** Zooms the map to a single feature's bounding box. */
export const zoomToFeature = (
    feature: ExtendedFeature,
    map: MapLibreMap,
    sourceCRS: string,
    options: ZoomToFeatureOptions = {}
) => {
    if (!map) return;

    const {
        maxZoom = DEFAULT_ZOOM_TO_FEATURE_MAX_ZOOM,
        padding = 50,
        animate = true,
    } = options;

    let bbox: number[] | null = null;

    // Try to get bbox from feature
    if (feature.bbox) {
        bbox = convertBbox(feature.bbox, sourceCRS);
    }
    // If no bbox, calculate from geometry
    else if (feature.geometry && feature.geometry.type === 'Point') {
        const coords = feature.geometry.coordinates as [number, number];
        const converted = convertCoordinate(coords, sourceCRS) as [number, number];
        // Create a buffer around the point (100 meters)
        const bboxResult = createPointBufferBbox(converted, 0.1);
        if (bboxResult) {
            bbox = bboxResult;
        }
    }
    // For other geometry types, try to calculate bounds
    else if (feature.geometry) {
        bbox = calculateGeometryBounds(feature.geometry, sourceCRS);
    }

    if (!bbox) {
        return;
    }

    // bbox is [minLng, minLat, maxLng, maxLat]
    map.fitBounds([
        [bbox[0], bbox[1]], // southwest corner
        [bbox[2], bbox[3]]  // northeast corner
    ], {
        padding,
        animate,
        maxZoom,
    });
}

/** Zooms the map to fit multiple features. */
export const zoomToFeatures = (
    features: ExtendedFeature[],
    map: MapLibreMap,
    sourceCRS: string,
    options: ZoomToFeatureOptions = {}
) => {
    if (!map || features.length === 0) return;

    if (features.length === 1) {
        zoomToFeature(features[0], map, sourceCRS, options);
        return;
    }

    const {
        maxZoom = DEFAULT_ZOOM_TO_FEATURE_MAX_ZOOM,
        padding = 50,
        animate = true,
    } = options;

    // Calculate combined bounds of all features
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const feature of features) {
        let featureBbox: number[] | null = null;

        if (feature.bbox) {
            featureBbox = convertBbox(feature.bbox, sourceCRS);
        } else if (feature.geometry) {
            featureBbox = calculateGeometryBounds(feature.geometry, sourceCRS);
        }

        if (featureBbox) {
            minX = Math.min(minX, featureBbox[0]);
            minY = Math.min(minY, featureBbox[1]);
            maxX = Math.max(maxX, featureBbox[2]);
            maxY = Math.max(maxY, featureBbox[3]);
        }
    }

    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
        return;
    }

    map.fitBounds([
        [minX, minY],
        [maxX, maxY]
    ], {
        padding,
        animate,
        maxZoom,
    });
}

// Helper function to calculate bounds from geometry
function calculateGeometryBounds(geometry: Geometry, sourceCRS: string): number[] | null {
    try {
        if (geometry.type === 'Point') {
            const coords = geometry.coordinates as [number, number];
            const converted = convertCoordinate(coords, sourceCRS) as [number, number];
            return createPointBufferBbox(converted, 0.1);
        }
        const wgs84 = convertGeometryToWGS84(geometry, sourceCRS);
        if (!wgs84) return null;
        const [minX, minY, maxX, maxY] = turfBbox(wgs84);
        return [minX, minY, maxX, maxY];
    } catch (error) {
        console.error('[calculateGeometryBounds] Error:', error);
        return null;
    }
}


