import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { Feature } from 'geojson';
import { LayerOrderConfig } from "@/hooks/use-get-layer-configs";
import { LayerContentProps } from '@/components/custom/popups/popup-content-with-pagination';
import { useLayerUrl } from '@/context/layer-url-provider';
import type { MapPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import { GeoServerGeoJSON } from '@/lib/types/geoserver-types';
import type { MapLibreMap } from '@/lib/types/map-types';
import proj4 from 'proj4';

interface WMSQueryProps {
    mapPoint: MapPoint;
    map: MapLibreMap;
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
    map,
    layers,
    url,
    version = '1.3.0',
    headers = {},
    infoFormat = 'application/json',
    buffer = 10,
    featureCount = 50,
    cql_filter = null,
    coordinateAdapter,
    crs = 'EPSG:3857'
}: WMSQueryProps & { crs?: string }): Promise<any> {
    if (layers.length === 0) {
        console.warn('No layers specified to query.');
        return null;
    }

    // Get resolution and viewport dimensions from MapLibre
    const resolution = coordinateAdapter.getResolution(map);
    const width = map.getCanvas().width;
    const height = map.getCanvas().height;

    // Create bbox in Web Mercator (coordinateAdapter uses this)
    const bboxWebMercator = coordinateAdapter.createBoundingBox({
        mapPoint,
        resolution,
        buffer
    });

    // If requesting a different CRS, transform the bbox
    let minX = bboxWebMercator.minX;
    let minY = bboxWebMercator.minY;
    let maxX = bboxWebMercator.maxX;
    let maxY = bboxWebMercator.maxY;

    // console.log('[FetchWMSFeatureInfo] Initial bbox (Web Mercator):', { minX, minY, maxX, maxY, crs });

    if (crs !== 'EPSG:3857') {
        // Transform bbox from Web Mercator (3857) to target CRS
        // Transform the four corners
        const [minX_transformed, minY_transformed] = proj4('EPSG:3857', crs, [minX, minY]);
        const [maxX_transformed, maxY_transformed] = proj4('EPSG:3857', crs, [maxX, maxY]);

        // console.log('[FetchWMSFeatureInfo] Transformed bbox corners:', {
        //     min: [minX_transformed, minY_transformed],
        //     max: [maxX_transformed, maxY_transformed],
        //     targetCrs: crs
        // });

        // Get the min/max values (in case projection reverses axes)
        minX = Math.min(minX_transformed, maxX_transformed);
        minY = Math.min(minY_transformed, maxY_transformed);
        maxX = Math.max(minX_transformed, maxX_transformed);
        maxY = Math.max(minY_transformed, maxY_transformed);

        // console.log('[FetchWMSFeatureInfo] Final transformed bbox:', { minX, minY, maxX, maxY });
    }

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
    params.set('crs', crs);
    params.set('width', width.toString());
    params.set('height', height.toString());
    params.set('feature_count', featureCount.toString());
    params.set('buffer', '10'); // Buffer around query pixel to catch nearby features (especially thin lines)

    // Add version-specific pixel coordinates
    // For GetFeatureInfo, we query at a specific pixel in the rendered WMS image
    // Always use the center of the rendered image for consistent results
    const pixelX = Math.round(width / 2);
    const pixelY = Math.round(height / 2);

    if (version === '1.3.0') {
        params.set('i', pixelX.toString());
        params.set('j', pixelY.toString());
    } else {
        params.set('x', pixelX.toString());
        params.set('y', pixelY.toString());
    }

    if (cql_filter) {
        params.set('cql_filter', cql_filter);
    }

    const fullUrl = `${url}?${params.toString()}`;
    // console.log('[FetchWMSFeatureInfo] Sending request:', {
    //     layers: params.get('layers'),
    //     query_layers: params.get('query_layers'),
    //     cql_filter: params.get('cql_filter'),
    //     i: params.get('i'),
    //     j: params.get('j'),
    //     bbox: params.get('bbox')
    // });

    const response = await fetch(fullUrl, { headers });

    if (!response.ok) {
        console.error('[FetchWMSFeatureInfo] Request failed with status:', response.status);
        throw new Error(`GetFeatureInfo request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Handle both raster and vector responses
    if (data.results) {
        // Raster response
        return data.results[0]?.value;
    } else if (data.features) {
        // Vector response - add namespaces
        const namespaceMap = layers.reduce((acc, layer) => {
            const [namespace, layerName] = layer.split(':');
            if (namespace && layerName) {
                acc[layerName] = namespace;
            }
            return acc;
        }, {} as Record<string, string>);

        const featuresWithNamespace = data.features.map((feature: any) => {
            const layerName = feature.id?.split('.')[0];
            const namespace = namespaceMap[layerName] || null;
            return {
                ...feature,
                namespace,
            };
        });

        return { ...data, features: featuresWithNamespace };
    }

    return data;
}

/**
 * WFS GetFeature query for geometry-based feature retrieval
 * More reliable than WMS GetFeatureInfo for line and polygon features
 */
interface WFSQueryProps {
    mapPoint: MapPoint;
    layers: string[];
    url: string;
    cql_filter?: string | null;
    crs?: string;
    featureCount?: number;
}

export async function fetchWFSFeature({
    mapPoint,
    layers,
    url,
    cql_filter = null,
    crs = 'EPSG:4326',
    featureCount = 50
}: WFSQueryProps): Promise<any> {
    if (layers.length === 0) {
        console.warn('No layers specified for WFS query.');
        return null;
    }

    // Build CQL filter with spatial intersection using BBOX
    // Convert mapPoint to target CRS if needed
    let queryX = mapPoint.x;
    let queryY = mapPoint.y;

    if (crs !== 'EPSG:4326') {
        // mapPoint is in WGS84 (4326), transform to target CRS
        [queryX, queryY] = proj4('EPSG:4326', crs, [mapPoint.x, mapPoint.y]);
    }

    // Create a small buffer around the point for spatial intersection
    // Using a small buffer (100m) to catch nearby features
    const buffer = 100;
    const bbox = {
        minX: queryX - buffer,
        minY: queryY - buffer,
        maxX: queryX + buffer,
        maxY: queryY + buffer
    };

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('version', '2.0.0');
    params.set('request', 'GetFeature');
    params.set('typeNames', layers.join(','));
    params.set('outputFormat', 'application/json');
    // GeoServer limitation: bbox and cql_filter are mutually exclusive
    // If we have an attribute filter, use only bbox (no cql_filter needed for most cases)
    if (cql_filter) {
        // When we have attribute filters, just use them - skip spatial filter
        // This returns more results but is filtered by the layer's native filter
        const normalizedAttributeFilter = cql_filter.trim().replace(/\s*=\s*/g, '=');
        params.set('cql_filter', normalizedAttributeFilter);
        params.set('count', featureCount.toString());
    } else {
        // No attribute filter, use bbox for spatial filtering
        params.set('bbox', `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY},${crs}`);
        params.set('count', featureCount.toString());
    }

    const fullUrl = `${url}?${params.toString()}`;
    // console.log('[FetchWFSFeature] Querying layers:', { layers, crs, geometryField: geometryFieldName, spatialFilter });

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) {
            console.error('[FetchWFSFeature] Request failed with status:', response.status);
            throw new Error(`WFS GetFeature request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
            // console.log('[FetchWFSFeature] Features returned:', data.features.length);

            // Add namespace to features for consistency with WMS response
            const namespaceMap = layers.reduce((acc, layer) => {
                const [namespace, layerName] = layer.split(':');
                if (namespace && layerName) {
                    acc[layerName] = namespace;
                }
                return acc;
            }, {} as Record<string, string>);

            const featuresWithNamespace = data.features.map((feature: any) => {
                const layerName = feature.id?.split('.')[0];
                const namespace = namespaceMap[layerName] || null;
                return {
                    ...feature,
                    namespace,
                };
            });

            return { ...data, features: featuresWithNamespace };
        }

        // console.log('[FetchWFSFeature] No features found');
        return data;
    } catch (error) {
        console.error('[FetchWFSFeature] Error:', error);
        throw error;
    }
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
    map: MapLibreMap;
    wmsUrl: string;
    visibleLayersMap: Record<string, LayerContentProps>;
    layerOrderConfigs: LayerOrderConfig[];
    coordinateAdapter: CoordinateAdapter;
}

export function useFeatureInfoQuery({
    map,
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
        if (!map || !mapPoint) {
            console.log('[FeatureInfoQuery] Early return - no map or mapPoint');
            return [];
        }

        const queryableLayers = Object.entries(visibleLayersMap)
            .filter(([_, layerInfo]) => layerInfo.visible && layerInfo.queryable)
            .map(([key]) => key);

        console.log('[FeatureInfoQuery] Queryable layers (filtered):', queryableLayers);

        if (queryableLayers.length === 0) {
            // console.log('[FeatureInfoQuery] No queryable layers');
            return [];
        }

        // Query each layer separately to avoid rendering occlusion issues
        // When multiple layers are rendered together, only the top layer is returned at a given pixel
        const allFeatures: Feature[] = [];
        let sourceCRS = 'EPSG:4326'; // Default, will be updated from responses

        for (const layerKey of queryableLayers) {
            const layerConfig = visibleLayersMap[layerKey];
            const layerCrs = (layerConfig as any)?.layerCrs || 'EPSG:3857';

            // Get the CQL filter for this specific layer
            const layerTitle = getLayerTitle(layerConfig);
            const staticFilter = getStaticCqlFilter(layerConfig);
            const dynamicFilter = activeFilters && activeFilters[layerTitle];

            const layerFilters: string[] = [];
            if (staticFilter) layerFilters.push(staticFilter);
            if (dynamicFilter) layerFilters.push(dynamicFilter);
            const layerCqlFilter = layerFilters.length > 0 ? layerFilters.join(' AND ') : null;

            // console.log(`[FeatureInfoQuery] Querying layer separately: ${layerKey} with CRS ${layerCrs}`);

            // Use WFS instead of WMS for more reliable geometry-based queries
            const wfsUrl = wmsUrl.replace('/wms', '/wfs');
            const featureInfo = await fetchWFSFeature({
                mapPoint,
                layers: [layerKey],
                url: wfsUrl,
                cql_filter: layerCqlFilter,
                crs: layerCrs,
                featureCount: 50
            });

            if (featureInfo && featureInfo.features && featureInfo.features.length > 0) {
                // console.log(`[FeatureInfoQuery] Layer ${layerKey}: ${featureInfo.features.length} features returned`);
                allFeatures.push(...featureInfo.features);
                sourceCRS = getSourceCRSFromGeoJSON(featureInfo);
            } else {
                // console.log(`[FeatureInfoQuery] Layer ${layerKey}: 0 features returned`);
            }
        }

        if (allFeatures.length === 0) {
            // console.log('[FeatureInfoQuery] No features returned from any layer');
            return [];
        }

        const featureInfo = { features: allFeatures, crs: { type: 'name', properties: { name: `urn:ogc:def:crs:EPSG::${sourceCRS.split(':')[1]}` } } };
        // console.log('[FeatureInfoQuery] Total features from all layers:', allFeatures.length);

        const layerInfoPromises = Object.entries(visibleLayersMap)
            .filter(([_, value]) => value.visible)
            .map(async ([key, value]) => {
                const matchingFeatures = featureInfo.features.filter((feature: Feature) => {
                    const featureId = feature.id?.toString() || '';
                    const keyParts = key.split(':');

                    // Handle different layer key formats
                    if (keyParts.length >= 2) {
                        // Format: "namespace:layername"
                        const namespace = keyParts[0];
                        const layerName = keyParts[1];

                        // Check if feature ID contains the layer name (common GeoServer pattern)
                        const matches = featureId.includes(layerName) || featureId.includes(namespace);
                        if (!matches && featureId) {
                            // console.log('[FeatureInfoQuery] Feature ID mismatch:', { featureId, layerName, namespace, key });
                        }
                        return matches;
                    } else {
                        // Fallback: check if feature ID contains the full key
                        return featureId.includes(key);
                    }
                });

                // console.log('[FeatureInfoQuery] Layer filter:', { key, matchCount: matchingFeatures.length, featureSample: featureInfo.features[0]?.id });

                const baseLayerInfo = {
                    customLayerParameters: value.customLayerParameters,
                    visible: value.visible,
                    layerTitle: value.layerTitle,
                    groupLayerTitle: value.groupLayerTitle,
                    sourceCRS: sourceCRS,
                    features: matchingFeatures,
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
                        map,
                        layers: [value.rasterSource.layerName],
                        url: value.rasterSource.url,
                        coordinateAdapter
                    });
                    baseLayerInfo.rasterSource = { ...value.rasterSource, data: rasterFeatureInfo };
                }

                return baseLayerInfo as LayerContentProps;
            });

        const resolvedLayerInfo = await Promise.all(layerInfoPromises);

        const layerInfoFiltered = resolvedLayerInfo.filter(layer => layer.features.length > 0);
        // console.log('[FeatureInfoQuery] Layers with features:', layerInfoFiltered.map(l => ({ title: l.layerTitle, count: l.features.length })));

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