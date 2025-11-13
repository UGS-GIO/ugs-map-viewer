import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { LayerOrderConfig } from "@/hooks/use-get-layer-configs";
import { LayerContentProps } from '@/components/custom/popups/popup-content-with-pagination';
import { useLayerUrl } from '@/context/layer-url-provider';
import { MapPoint, CoordinateAdapter } from '@/lib/map/coordinate-adapter';
import { GeoServerGeoJSON } from '@/lib/types/geoserver-types';

interface WMSQueryProps {
    mapPoint: MapPoint;
    view: __esri.MapView | __esri.SceneView;
    layers: string[];
    url: string;
    version?: '1.1.1' | '1.3.0';
    headers?: Record<string, string>;
    infoFormat?: string;
    buffer?: number;
    featureCount?: number;
    cql_filter?: string | null;
    coordinateAdapter: CoordinateAdapter;
}

export async function fetchWMSFeatureInfo({
    mapPoint,
    view,
    layers,
    url,
    version = '1.3.0',
    headers = {},
    infoFormat = 'application/json',
    buffer = 10,
    featureCount = 50,
    cql_filter = null,
    coordinateAdapter
}: WMSQueryProps): Promise<any> {
    if (layers.length === 0) {
        console.warn('No layers specified to query.');
        return null;
    }

    const bbox = coordinateAdapter.createBoundingBox({
        mapPoint,
        resolution: view.resolution,
        buffer
    });

    const { minX, minY, maxX, maxY } = bbox;

    // Different versions handle coordinates differently
    const bboxString = version === '1.1.1'
        ? `${minY},${minX},${maxY},${maxX}` // 1.1.0 uses lat,lon order
        : `${minX},${minY},${maxX},${maxY}`; // 1.3.1 uses lon,lat order

    const params = new URLSearchParams();

    // Add base parameters
    params.set('service', 'WMS');
    params.set('request', 'GetFeatureInfo');
    params.set('version', version);
    params.set('layers', layers.join(','));
    params.set('query_layers', layers.join(','));
    params.set('info_format', infoFormat);
    params.set('bbox', bboxString);
    params.set('crs', 'EPSG:3857');
    params.set('width', view.width.toString());
    params.set('height', view.height.toString());
    params.set('feature_count', featureCount.toString());

    // Add version-specific pixel coordinates
    if (version === '1.3.0') {
        params.set('i', Math.round(view.width / 2).toString());
        params.set('j', Math.round(view.height / 2).toString());
    } else {
        params.set('x', Math.round(view.width / 2).toString());
        params.set('y', Math.round(view.height / 2).toString());
    }

    if (cql_filter) {
        params.set('cql_filter', cql_filter);
    }

    const fullUrl = `${url}?${params.toString()}`;
    const response = await fetch(fullUrl, { headers });

    if (!response.ok) {
        throw new Error(`GetFeatureInfo request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Handle both raster and vector responses
    if (data.results) {
        // Raster response
        return data.results[0]?.value;
    } else if (data.features) {
        // Vector response - add namespaces
        const namespaceMap: Record<string, string> = layers.reduce((acc: Record<string, string>, layer) => {
            const [namespace, layerName] = layer.split(':');
            if (namespace && layerName) {
                acc[layerName] = namespace;
            }
            return acc;
        }, {});

        const featuresWithNamespace = data.features.map((feature: Feature<Geometry, GeoJsonProperties>) => {
            const layerName = feature.id?.toString().split('.')[0];
            const namespace = layerName ? namespaceMap[layerName] || null : null;
            return {
                ...feature,
                namespace,
            };
        });

        return { ...data, features: featuresWithNamespace };
    }

    return data;
}

// Reorder layers based on the specified order config. this is useful for reordering layers in the popup
const reorderLayers = (layerInfo: LayerContentProps[], layerOrderConfigs: LayerOrderConfig[]): LayerContentProps[] => {
    // First, create an object to map layer names to their desired positions
    const layerPositions: Record<string, number> = {};

    // Loop through layerOrderConfigs and assign positions
    layerOrderConfigs.forEach(config => {
        if (config.position === 'start') {
            layerPositions[config.layerName] = -Infinity; // Move to the front
        } else if (config.position === 'end') {
            layerPositions[config.layerName] = Infinity; // Move to the back
        }
    });

    // Now, sort the layers based on these positions
    return layerInfo.sort((a, b) => {
        // Determine the title to use for layer A (considering empty layerTitle)
        const aLayerTitle = a.layerTitle.trim() || a.groupLayerTitle.trim() || "Unnamed Layer";
        // Determine the title to use for layer B
        const bLayerTitle = b.layerTitle.trim() || b.groupLayerTitle.trim() || "Unnamed Layer";

        // Get positions from the layerPositions map (default to 0 if not found)
        const aPosition = layerPositions[aLayerTitle] ?? 0;
        const bPosition = layerPositions[bLayerTitle] ?? 0;

        // Compare positions
        return aPosition - bPosition;
    });
};

/**
 * Safely parses the CRS from a GeoJSON object from GeoServer.
 * Defaults to WGS 84 ('EPSG:4326') if the crs member is missing, per the GeoJSON spec.
 * @param geoJson - The GeoServer GeoJSON object to extract the CRS from.
 * @returns The CRS in EPSG format (e.g., 'EPSG:4326')
 */
export const getSourceCRSFromGeoJSON = (geoJson: GeoServerGeoJSON): string => {
    const crsName = geoJson?.crs?.properties?.name;
    if (typeof crsName === 'string') {
        // Handle URN format: "urn:ogc:def:crs:EPSG::4326"
        const urnMatch = crsName.match(/^urn:ogc:def:crs:EPSG::(\d+)$/);
        if (urnMatch && urnMatch[1]) {
            return `EPSG:${urnMatch[1]}`;
        }

        // Handle direct EPSG format: "EPSG:4326"
        const epsgMatch = crsName.match(/^EPSG:(\d+)$/);
        if (epsgMatch && epsgMatch[1]) {
            return `EPSG:${epsgMatch[1]}`;
        }

        // Handle legacy format with double colon: "EPSG::4326"
        const legacyMatch = crsName.match(/^EPSG::(\d+)$/);
        if (legacyMatch && legacyMatch[1]) {
            return `EPSG:${legacyMatch[1]}`;
        }

        // If it already starts with EPSG: and looks valid, return as-is
        if (crsName.startsWith('EPSG:') && /^EPSG:\d+$/.test(crsName)) {
            return crsName;
        }
    }
    // If no CRS is specified, default to WGS 84
    return 'EPSG:4326';
};

/**
 * getLayerTitle
 * Utility function to get the layer title from a LayerContentProps object.
 */
export function getLayerTitle(layer: LayerContentProps): string {
    return layer.layerTitle?.trim() || layer.groupLayerTitle?.trim() || "Unnamed Layer";
}

/**
 * getStaticCqlFilter
 * Utility function to get the static CQL filter from a LayerContentProps object.
 */
export function getStaticCqlFilter(layer: LayerContentProps): string | null {
    if (!layer) return null;
    return layer.customLayerParameters?.cql_filter || null;
}

interface UseFeatureInfoQueryProps {
    view: __esri.MapView | __esri.SceneView | undefined;
    wmsUrl: string;
    visibleLayersMap: Record<string, LayerContentProps>;
    layerOrderConfigs: LayerOrderConfig[];
    coordinateAdapter: CoordinateAdapter;
}

export function useFeatureInfoQuery({
    view,
    wmsUrl,
    visibleLayersMap,
    layerOrderConfigs,
    coordinateAdapter
}: UseFeatureInfoQueryProps) {
    const [mapPoint, setMapPoint] = useState<MapPoint | null>(null);
    const { activeFilters } = useLayerUrl();

    // Track unique click IDs - increment on each new click
    const clickIdRef = useRef(0);
    const [currentClickId, setCurrentClickId] = useState<number | null>(null);

    const queryFn = async (): Promise<LayerContentProps[]> => {
        if (!view || !mapPoint) return [];

        const queryableLayers = Object.entries(visibleLayersMap)
            .filter(([_, layerInfo]) => layerInfo.visible && layerInfo.queryable)
            .map(([key]) => key);

        if (queryableLayers.length === 0) return [];

        // Create a mapping from titles to layer keys for easier lookup
        const titleToKeyMap: Record<string, string> = {};
        Object.entries(visibleLayersMap).forEach(([key, layerConfig]) => {
            const layerTitle = getLayerTitle(layerConfig);
            titleToKeyMap[layerTitle] = key;
        });

        // Build CQL filters - one filter per layer, separated by semicolons
        let combinedCqlFilter: string | null = null;

        // Check if we have any filters at all
        const hasAnyFilters = queryableLayers.some(layerKey => {
            const layerConfig = visibleLayersMap[layerKey];

            const layerTitle = getLayerTitle(layerConfig);
            const staticFilter = getStaticCqlFilter(layerConfig);

            const dynamicFilter = activeFilters && activeFilters[layerTitle];
            return staticFilter || dynamicFilter;
        });

        if (hasAnyFilters) {
            const filterParts: string[] = [];

            // Build one filter per layer in the same order as queryableLayers
            queryableLayers.forEach(layerKey => {
                const layerConfig = visibleLayersMap[layerKey];
                const layerTitle = getLayerTitle(layerConfig);
                // Collect filters for this specific layer
                const layerFilters: string[] = [];

                // Add static filter from the layer's config (if it exists)
                const staticFilter = getStaticCqlFilter(layerConfig);
                if (staticFilter) {
                    layerFilters.push(staticFilter);
                }

                // Add dynamic filter from the URL via the context hook - match by title
                if (activeFilters && activeFilters[layerTitle]) {
                    layerFilters.push(activeFilters[layerTitle]);
                }

                // Combine filters for this layer with AND, or use INCLUDE if no filters
                if (layerFilters.length > 0) {
                    const combinedLayerFilter = layerFilters.join(' AND ');
                    filterParts.push(combinedLayerFilter);
                } else {
                    // In WMS CQL filter context, 'INCLUDE' acts as a no-op filter for layers without specific filters. 
                    // If omitted, the WMS server may skip the layer or return an error, so it must be present for each layer.
                    filterParts.push('INCLUDE');
                }
            });

            // Join all layer filters with semicolons
            combinedCqlFilter = filterParts.join(';');
        }

        const featureInfo = await fetchWMSFeatureInfo({
            mapPoint,
            view,
            layers: queryableLayers,
            url: wmsUrl,
            cql_filter: combinedCqlFilter,
            coordinateAdapter,
            buffer: 1000
        });

        if (!featureInfo || !featureInfo.features) return [];

        const sourceCRS = getSourceCRSFromGeoJSON(featureInfo);

        const layerInfoPromises = Object.entries(visibleLayersMap)
            .filter(([_, value]) => value.visible)
            .map(async ([key, value]): Promise<LayerContentProps> => {
                const baseLayerInfo: LayerContentProps = {
                    customLayerParameters: value.customLayerParameters,
                    visible: value.visible,
                    layerTitle: value.layerTitle,
                    groupLayerTitle: value.groupLayerTitle,
                    sourceCRS: sourceCRS,
                    features: featureInfo.features.filter((feature: Feature) => {
                        const featureId = feature.id?.toString() || '';
                        const keyParts = key.split(':');

                        // Handle different layer key formats
                        if (keyParts.length >= 2) {
                            // Format: "namespace:layername"
                            const namespace = keyParts[0];
                            const layerName = keyParts[1];

                            // Check if feature ID contains the layer name (common GeoServer pattern)
                            return featureId.includes(layerName) || featureId.includes(namespace);
                        } else {
                            // Fallback: check if feature ID contains the full key
                            return featureId.includes(key);
                        }
                    }),
                    popupFields: value.popupFields,
                    linkFields: value.linkFields,
                    colorCodingMap: value.colorCodingMap,
                    relatedTables: value.relatedTables?.map(table => ({
                        ...table,
                        matchingField: table.matchingField || "",
                        fieldLabel: table.fieldLabel || ""
                    })),
                    schema: value.schema,
                    rasterSource: value.rasterSource
                };

                if (value.rasterSource) {
                    const rasterFeatureInfo = await fetchWMSFeatureInfo({
                        mapPoint,
                        view,
                        layers: [value.rasterSource.layerName],
                        url: value.rasterSource.url,
                        coordinateAdapter
                    });
                    baseLayerInfo.rasterSource = { ...value.rasterSource, data: rasterFeatureInfo };
                }

                return baseLayerInfo;
            });

        const resolvedLayerInfo = await Promise.all(layerInfoPromises);
        const layerInfoFiltered = resolvedLayerInfo.filter(layer => layer.features.length > 0);

        return layerOrderConfigs.length > 0
            ? reorderLayers(layerInfoFiltered, layerOrderConfigs)
            : layerInfoFiltered;
    };

    // Remove activeFilters from queryKey - we don't want filter changes to invalidate the query
    const { data, isFetching, isSuccess, refetch } = useQuery({
        queryKey: ['wmsFeatureInfo', coordinateAdapter.toJSON(mapPoint), currentClickId],
        queryFn,
        enabled: false,
        refetchOnWindowFocus: false,
    });

    const fetchForPoint = (point: MapPoint) => {
        // Generate new click ID for each map click
        clickIdRef.current += 1;
        setCurrentClickId(clickIdRef.current);
        setMapPoint(point);
    };

    // trigger refetch when mapPoint changes (which means new click happened)
    useEffect(() => {
        if (mapPoint && currentClickId !== null) {
            refetch();
        }
    }, [mapPoint, currentClickId, refetch]);

    return {
        fetchForPoint,
        data: isSuccess ? data : [],
        isFetching,
        isSuccess,
        lastClickedPoint: mapPoint,
        clickId: currentClickId,
    };
}