import { GroupLayerProps, WMSLayerProps } from '@/lib/types/mapping-types'
import { LayerProps } from "@/lib/types/mapping-types";
import { ExtendedFeature } from '@/components/maps/popups/types';
import { convertBbox, convertCoordinate } from '@/lib/map/conversion-utils';
import { createMapFactory } from '@/lib/map/factory/factory';
import type { Geometry } from 'geojson';
import { buffer } from '@turf/buffer';
import { point } from '@turf/helpers';
import { bbox as turfBbox } from '@turf/bbox';
import type { MapLibreMap } from '@/lib/types/map-types';

export const DEFAULT_ZOOM_TO_FEATURE_MAX_ZOOM = 14;

export interface ZoomToFeatureOptions {
    maxZoom?: number;
    padding?: number;
    animate?: boolean;
}

/**
 * Create a bounding box around a point with a given radius buffer.
 * Uses Turf for accurate buffering at any latitude.
 *
 * @param coords - [lng, lat] coordinates in WGS84
 * @param radiusKm - Buffer radius in kilometers (default: 0.1 = 100m)
 * @returns [minX, minY, maxX, maxY] bbox or null if buffering fails
 */
export function createPointBufferBbox(
    coords: [number, number],
    radiusKm: number = 0.1
): [number, number, number, number] | null {
    try {
        const pointFeature = point(coords);
        const bufferedFeature = buffer(pointFeature, radiusKm, { units: 'kilometers' });
        if (bufferedFeature) {
            const bboxResult = turfBbox(bufferedFeature);
            if (bboxResult) {
                return bboxResult as [number, number, number, number];
            }
        }
    } catch (error) {
        console.warn('[createPointBufferBbox] Error buffering point:', error);
    }
    return null;
}

export function findLayerByTitle(mapInstance: MapLibreMap, title: string): MapLibreLayerProxy | null {
    // Use factory for MapLibre - returns a proxy object with setter hooks
    const factory = createMapFactory();
    const layerSpec = factory.findLayerByTitle(mapInstance, title);

    if (layerSpec) {
        // Return a proxy object that allows setting opacity and visibility
        // The proxy intercepts property assignments and applies them to the MapLibre layer
        return new MapLibreLayerProxy(mapInstance, layerSpec.id);
    }
    return null;
}

/**
 * Proxy object for MapLibre layers to allow setting opacity and visibility
 * like ArcGIS layers, while applying changes to the MapLibre map instance.
 */
class MapLibreLayerProxy {
    private map: MapLibreMap;
    private layerId: string;
    private _opacity: number;
    private _layerType: string;

    constructor(map: MapLibreMap, layerId: string) {
        this.map = map;
        this.layerId = layerId;
        // Cache the layer type on construction
        this._layerType = this.getLayerType();
        // Read initial opacity from the map layer
        this._opacity = this.readCurrentOpacity();
    }

    private readCurrentOpacity(): number {
        if (!this.map) return 1;
        try {
            const opacityProp = this.getOpacityProperty();
            const currentOpacity = this.map.getPaintProperty(this.layerId, opacityProp);
            return typeof currentOpacity === 'number' ? currentOpacity : 1;
        } catch {
            return 1;
        }
    }

    private getLayerType(): string {
        if (!this.map) return 'raster';
        const layer = this.map.getLayer(this.layerId);
        return layer?.type || 'raster';
    }

    private getOpacityProperty(): string {
        switch (this._layerType) {
            case 'fill':
                return 'fill-opacity';
            case 'line':
                return 'line-opacity';
            case 'circle':
                return 'circle-opacity';
            case 'symbol':
                return 'icon-opacity';
            case 'raster':
            default:
                return 'raster-opacity';
        }
    }

    get opacity(): number {
        return this._opacity;
    }

    set opacity(value: number) {
        this._opacity = value;
        if (this.map && typeof this.map.setPaintProperty === 'function') {
            const opacityProp = this.getOpacityProperty();
            this.map.setPaintProperty(this.layerId, opacityProp, value);
        }
    }

    get visible(): boolean {
        if (!this.map) return true;
        const visibility = this.map.getLayoutProperty(this.layerId, 'visibility');
        return visibility !== 'none';
    }

    set visible(value: boolean) {
        if (this.map && typeof this.map.setLayoutProperty === 'function') {
            this.map.setLayoutProperty(this.layerId, 'visibility', value ? 'visible' : 'none');
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
            // Create a buffer around the point (100 meters)
            return createPointBufferBbox(converted, 0.1);
        } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
            const coords = geometry.coordinates as [number, number][];
            if (!coords.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const coord of coords) {
                const converted = convertCoordinate(coord, sourceCRS);
                minX = Math.min(minX, converted[0]);
                minY = Math.min(minY, converted[1]);
                maxX = Math.max(maxX, converted[0]);
                maxY = Math.max(maxY, converted[1]);
            }
            return [minX, minY, maxX, maxY];
        } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
            const rings = geometry.coordinates as [number, number][][];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const ring of rings) {
                for (const coord of ring) {
                    const converted = convertCoordinate(coord, sourceCRS);
                    minX = Math.min(minX, converted[0]);
                    minY = Math.min(minY, converted[1]);
                    maxX = Math.max(maxX, converted[0]);
                    maxY = Math.max(maxY, converted[1]);
                }
            }
            return [minX, minY, maxX, maxY];
        } else if (geometry.type === 'MultiPolygon') {
            const polygons = geometry.coordinates as [number, number][][][];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const polygon of polygons) {
                for (const ring of polygon) {
                    for (const coord of ring) {
                        const converted = convertCoordinate(coord, sourceCRS);
                        minX = Math.min(minX, converted[0]);
                        minY = Math.min(minY, converted[1]);
                        maxX = Math.max(maxX, converted[0]);
                        maxY = Math.max(maxY, converted[1]);
                    }
                }
            }
            return [minX, minY, maxX, maxY];
        }
        return null;
    } catch (error) {
        console.error('[calculateGeometryBounds] Error:', error);
        return null;
    }
}

// Type guard to check if the layer is a WMSLayerProps
export const isWMSLayer = (layer: LayerProps): layer is WMSLayerProps => {
    return layer.type === 'wms';
}

// Type guard to check if the layer is a GroupLayerProps
export const isGroupLayer = (layer: LayerProps): layer is GroupLayerProps => {
    return layer.type === 'group';
}


