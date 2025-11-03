import SceneView from '@arcgis/core/views/SceneView'
import MapView from '@arcgis/core/views/MapView'
import { GroupLayerProps, LayerConstructor, MapApp, WMSLayerProps } from '@/lib/types/mapping-types'
import GroupLayer from "@arcgis/core/layers/GroupLayer";
import Map from '@arcgis/core/Map'
import { LayerProps, layerTypeMapping } from "@/lib/types/mapping-types";
import Popup from "@arcgis/core/widgets/Popup";
import { basemapList } from '@/components/top-nav';
import { ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';
import { convertBbox, convertCoordinate } from '@/lib/map/conversion-utils';
import Extent from '@arcgis/core/geometry/Extent';
import { createMapFactory } from '@/lib/map/factory/factory';
import type { Geometry } from 'geojson';
import { buffer } from '@turf/buffer';
import { point } from '@turf/helpers';
import { bbox as turfBbox } from '@turf/bbox';


const app: MapApp = {};

export function findLayerByTitle(mapInstance: __esri.Map | any, title: string): __esri.Layer | any | null {
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
    private map: any;
    private layerId: string;
    private _opacity: number = 1;

    constructor(map: any, layerId: string) {
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
 * Initializes a map and its view within a specified container.
 *
 * @param container - The HTMLDivElement that will contain the map view.
 * @param isMobile - A boolean indicating if the view should be optimized for mobile devices.
 * @param options - An object containing the initial zoom level and center coordinates.
 * @param layers - An array of layer properties to be added to the map.
 * @param initialView - An optional parameter that specifies whether to initialize as a 'map' or 'scene' view.
 * @returns A promise that resolves to an object containing the initialized map and view.
 */
export async function init(
    container: HTMLDivElement,
    isMobile: boolean,
    { zoom, center }: { zoom: number, center: [number, number] },
    layers: LayerProps[],
    initialView?: 'map' | 'scene',
): Promise<{ map: __esri.Map, view: __esri.MapView | __esri.SceneView }> {
    // Destroy the view if it exists
    if (app.view) {
        app.view.destroy();
    }

    // Create a new map and view
    const map = createMap();

    // Create the view
    const view = createView(container, map, initialView, isMobile, { zoom, center });

    // Add layers to the map
    await addLayersToMap(map, layers);

    return { map, view };
}

// Create a new map
export const createMap = () => {
    const map = new Map({
        basemap: basemapList.find(item => item.isActive)?.basemapStyle, // Default basemap
    });
    return map;
}

// Create a new view
export const createView = (
    container: HTMLDivElement,
    map: Map,
    viewType: 'map' | 'scene' = 'scene',
    isMobile: boolean,
    initialView: { zoom: number; center: [number, number] } // Changed to [number, number] for more flexibility
) => {
    // Common options for both MapView and SceneView
    const commonOptions = {
        container,
        map,
        zoom: initialView.zoom,
        center: initialView.center,
        // highlightOptions: {
        //     color: new Color([255, 255, 0, 1]),
        //     haloColor: new Color("white"),
        //     haloOpacity: 0.9,
        //     fillOpacity: 0.2,
        // },
        ui: {
            components: ['zoom', 'compass', 'attribution'],
        },
        ...(!isMobile && {
            popup: new Popup({
                dockEnabled: true,
                dockOptions: {
                    buttonEnabled: false,
                    breakpoint: false,
                    position: 'bottom-left',
                },
            }),
        }),
    };

    return viewType === 'scene'
        ? new SceneView({ ...commonOptions })
        : new MapView({ ...commonOptions });
};

/**
 * Adds layers to the map with WMS optimization by batching GetCapabilities requests but maintaining individual layer structure.
 *
 * @param map - The ArcGISMap instance to which layers will be added.
 * @param layersConfig - An array of LayerProps that defines the layers to be added to the map.
 * @returns A promise that resolves when the layers have been added to the map.
 */
export const addLayersToMap = async (map: Map, layersConfig: LayerProps[]) => {
    // Create all layers first
    const createdLayers: __esri.Layer[] = [];

    for (const layer of layersConfig) {
        const createdLayer = createLayer(layer) as __esri.Layer;
        if (createdLayer) {
            createdLayers.push(createdLayer);
        }
    }

    // Add all layers at once in reverse order to maintain the correct drawing order
    if (createdLayers.length > 0) {
        map.addMany(createdLayers.reverse());
    }
}

/**
 * Creates a layer from the given URL and layer properties.
 *
 * @param layer - The properties of the layer to create.
 * @param LayerType - The constructor for the layer type.
 * @returns The created layer instance or undefined if the layer type is unsupported or if the URL is missing.
 */
function createLayerFromUrl(layer: LayerProps, LayerType: LayerConstructor) {
    if (!LayerType) {
        console.warn(`Unsupported layer type: ${layer.type}`);
        return undefined;
    }

    if (layer.type === 'wms') {
        const typedLayer = layer as WMSLayerProps;
        return new LayerType({
            url: typedLayer.url,
            title: typedLayer.title,
            visible: typedLayer.visible,
            sublayers: typedLayer.sublayers,
            opacity: layer.opacity,
            customLayerParameters: typedLayer.customLayerParameters,
        });
    }

    if (layer.url) {
        return new LayerType({
            url: layer.url,
            title: layer.title,
            visible: layer.visible,
            opacity: layer.opacity,
            ...layer.options,
        });
    }

    console.warn(`Missing URL in layer props: ${JSON.stringify(layer)}`);
    return undefined;
}

/**
 * Creates a layer instance from layer properties.
 *
 * @param layer - The layer properties to create a layer from.
 * @returns The created layer instance.
 * @throws Error if the layer type is unsupported or required properties are missing.
 */
export const createLayer = (layer: LayerProps) => {
    if (layer.type === 'group') {
        const typedLayer = layer as GroupLayerProps;
        // Recursively create group layers and reverse the order
        const groupLayers = typedLayer.layers?.map(createLayer).filter(layer => layer !== undefined).reverse() as __esri.CollectionProperties<__esri.Layer> | undefined;
        return new GroupLayer({
            title: layer.title,
            visible: layer.visible,
            layers: groupLayers,
        });
    }

    const LayerType = layerTypeMapping[layer.type];

    if (LayerType) {
        return createLayerFromUrl(layer, LayerType);
    }

    console.warn(`Unsupported layer type: ${layer.type}`);
    return undefined;
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
    viewOrMap: __esri.MapView | __esri.SceneView | any,
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

export const isWMSMapLayer = (layer: __esri.Layer): layer is __esri.WMSLayer => {
    return layer.type === 'wms';
}

export const isGroupMapLayer = (layer: __esri.Layer): layer is __esri.GroupLayer => {
    return layer.type === 'group';
}