import { GroupLayerProps, WMSLayerProps } from '@/lib/types/mapping-types'
import { LayerProps } from "@/lib/types/mapping-types";
import { ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import { convertBbox, convertCoordinate } from '@/lib/map/conversion-utils';
import Extent from '@arcgis/core/geometry/Extent';
import { createMapFactory } from '@/lib/map/factory/factory';
import type { Geometry } from 'geojson';
import { buffer } from '@turf/buffer';
import { point } from '@turf/helpers';
import { bbox as turfBbox } from '@turf/bbox';
import type { MapLibreMap } from '@/lib/types/map-types';

export function findLayerByTitle(mapInstance: __esri.Map | MapLibreMap, title: string): __esri.Layer | any | null {
    // Check if it's a MapLibre map (has getStyle method)
    if (mapInstance && typeof mapInstance.getStyle === 'function') {
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

    // Otherwise treat as ArcGIS map
    let foundLayer: __esri.Layer | null = null;
    if (mapInstance && mapInstance.layers) {
        mapInstance.layers.forEach((layer: any) => {
            if (layer.title === title) {
                foundLayer = layer;
            } else if (layer.type === 'group') {
                const groupLayer = layer as __esri.GroupLayer;
                // Search within sublayers of a group layer
                const subLayer = groupLayer.layers.find((childLayer: any) => childLayer.title === title);
                if (subLayer) {
                    foundLayer = subLayer;
                }
            }
        });
    }
    return foundLayer;
}

/**
 * Proxy object for MapLibre layers to allow setting opacity and visibility
 * like ArcGIS layers, while applying changes to the MapLibre map instance.
 */
class MapLibreLayerProxy {
    private map: MapLibreMap;
    private layerId: string;
    private _opacity: number = 1;

    constructor(map: MapLibreMap, layerId: string) {
        this.map = map;
        this.layerId = layerId;
    }

    get opacity(): number {
        return this._opacity;
    }

    set opacity(value: number) {
        this._opacity = value;
        if (this.map && typeof this.map.setPaintProperty === 'function') {
            this.map.setPaintProperty(this.layerId, 'raster-opacity', value);
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
        return 'raster';
    }
}


/**
 * Zooms the map or scene view to the bounding box of the specified feature.
 *
 * @param feature - The feature to zoom to, which must include a bounding box (bbox).
 * @param view - The MapView or SceneView instance to perform the zoom action on.
 * @param sourceCRS - The coordinate reference system of the feature's bounding box.
 */
export const zoomToFeature = (
    feature: ExtendedFeature,
    viewOrMap: __esri.MapView | __esri.SceneView | MapLibreMap,
    sourceCRS: string
) => {
    if (!viewOrMap) return;

    let bbox: number[] | null = null;

    // Try to get bbox from feature
    if (feature.bbox) {
        bbox = convertBbox(feature.bbox, sourceCRS);
    }
    // If no bbox, calculate from geometry
    else if (feature.geometry && feature.geometry.type === 'Point') {
        const coords = feature.geometry.coordinates as [number, number];
        const converted = convertCoordinate(coords, sourceCRS);
        // Create a buffer around the point using turf (100 meters)
        try {
            const pointFeature = point(converted);
            const bufferedFeature = buffer(pointFeature, 0.1, { units: 'kilometers' });
            if (bufferedFeature) {
                const bboxResult = turfBbox(bufferedFeature);
                if (bboxResult) {
                    bbox = bboxResult;
                }
            }
        } catch (error) {
            console.warn('[zoomToFeature] Error buffering point:', error);
        }
    }
    // For other geometry types, try to calculate bounds
    else if (feature.geometry) {
        bbox = calculateGeometryBounds(feature.geometry, sourceCRS);
    }

    if (!bbox) {
        console.warn('[zoomToFeature] Could not determine bbox for feature');
        return;
    }

    // Check if it's an ArcGIS view (has goTo method)
    if (viewOrMap?.goTo) {
        viewOrMap.goTo({
            target: new Extent({
                xmin: bbox[0],
                ymin: bbox[1],
                xmax: bbox[2],
                ymax: bbox[3],
                spatialReference: { wkid: 4326 }
            })
        });
    }
    // Check if it's a MapLibre map (has fitBounds method)
    else if (viewOrMap?.fitBounds) {
        // bbox is [minLng, minLat, maxLng, maxLat]
        viewOrMap.fitBounds([
            [bbox[0], bbox[1]], // southwest corner
            [bbox[2], bbox[3]]  // northeast corner
        ], {
            padding: 50,
            animate: true
        });
    }
}

// Helper function to calculate bounds from geometry
function calculateGeometryBounds(geometry: Geometry, sourceCRS: string): number[] | null {
    try {
        if (geometry.type === 'Point') {
            const coords = geometry.coordinates as [number, number];
            const converted = convertCoordinate(coords, sourceCRS);
            // Create a buffer around the point using turf (100 meters)
            try {
                const pointFeature = point(converted);
                const bufferedFeature = buffer(pointFeature, 0.1, { units: 'kilometers' });
                if (bufferedFeature) {
                    const bboxResult = turfBbox(bufferedFeature);
                    if (bboxResult) {
                        return bboxResult;
                    }
                }
            } catch (error) {
                console.warn('[calculateGeometryBounds] Error buffering point:', error);
            }
            return null;
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

