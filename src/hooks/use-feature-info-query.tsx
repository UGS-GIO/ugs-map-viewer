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
import { queryKeys } from '@/lib/query-keys';
import { useQueryBboxVisualizer } from '@/hooks/use-query-bbox-visualizer';
import booleanIntersects from '@turf/boolean-intersects';
import { polygon as turfPolygon } from '@turf/helpers';

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
    buffer = 25,
    featureCount = 50,
    cql_filter = null,
    coordinateAdapter,
    crs = 'EPSG:3857'
}: WMSQueryProps & { crs?: string }): Promise<GeoServerGeoJSON | null> {
    if (layers.length === 0) {
        console.warn('No layers specified to query.');
        return null;
    }

    // Get resolution and viewport dimensions from MapLibre
    const resolution = coordinateAdapter.getResolution(map);
    const width = map.getCanvas().width;
    const height = map.getCanvas().height;

    // Calculate buffer in meters
    const bufferInMeters = buffer * resolution;

    // Transform click point to target CRS first
    let centerX, centerY;
    if (crs !== 'EPSG:4326') {
        [centerX, centerY] = proj4('EPSG:4326', crs, [mapPoint.x, mapPoint.y]);
    } else {
        centerX = mapPoint.x;
        centerY = mapPoint.y;
    }

    // Apply buffer in the target CRS units
    // EPSG:4326 is in degrees - convert meters to approximate degrees
    // EPSG:3857 and EPSG:26912 (UTM) are in meters
    let bufferInTargetUnits = bufferInMeters;
    if (crs === 'EPSG:4326') {
        // At Utah's latitude (~39°), 1 degree ≈ 85km longitude, 111km latitude
        // Use 100km as conservative estimate to ensure we get results
        const degreesBuffer = bufferInMeters / 100000;
        bufferInTargetUnits = Math.max(degreesBuffer, 0.001);
    }

    const minX = centerX - bufferInTargetUnits;
    const minY = centerY - bufferInTargetUnits;
    const maxX = centerX + bufferInTargetUnits;
    const maxY = centerY + bufferInTargetUnits;

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

    // WMS 1.3.0 uses CRS, 1.1.1 uses SRS
    if (version === '1.3.0') {
        params.set('CRS', crs);
    } else {
        params.set('SRS', crs);
    }
    params.set('width', width.toString());
    params.set('height', height.toString());
    params.set('feature_count', featureCount.toString());
    params.set('buffer', buffer.toString()); // Buffer around query pixel to catch nearby features (especially point symbols)

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

        const featuresWithNamespace = data.features.map((feature: Feature) => {
            const layerName = feature.id ? String(feature.id).split('.')[0] : '';
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
    bufferMeters?: number;
}

export async function fetchWFSFeature({
    mapPoint,
    layers,
    url,
    cql_filter = null,
    crs = 'EPSG:4326',
    featureCount = 50,
    bufferMeters = 50,
    onBboxCalculated
}: WFSQueryProps & { onBboxCalculated?: (bbox: { minX: number; minY: number; maxX: number; maxY: number }, crs: string) => void }): Promise<GeoServerGeoJSON | null> {
    if (layers.length === 0) {
        console.warn('No layers specified for WFS query.');
        return null;
    }

    // Get the geometry field name for this layer
    let geometryField = await getGeometryFieldName(layers[0], url);
    if (!geometryField) {
        geometryField = 'shape'; // Common default
    }

    // Convert mapPoint to target CRS if needed
    let centerX, centerY;
    if (crs !== 'EPSG:4326') {
        // mapPoint is in WGS84 (4326), transform to target CRS
        [centerX, centerY] = proj4('EPSG:4326', crs, [mapPoint.x, mapPoint.y]);
    } else {
        centerX = mapPoint.x;
        centerY = mapPoint.y;
    }

    // Apply buffer in the target CRS units
    // EPSG:4326 is in degrees - convert meters to approximate degrees
    // EPSG:3857 and EPSG:26912 (UTM) are in meters
    let bufferInTargetUnits = bufferMeters;
    if (crs === 'EPSG:4326') {
        // At Utah's latitude (~39°), 1 degree ≈ 85km longitude, 111km latitude
        // Use 100km as conservative estimate to ensure we get results
        // 50m buffer -> ~0.0005 degrees, but use minimum of 0.001 (~100m) for reliability
        const degreesBuffer = bufferMeters / 100000;
        bufferInTargetUnits = Math.max(degreesBuffer, 0.001);
    }

    const bbox = {
        minX: centerX - bufferInTargetUnits,
        minY: centerY - bufferInTargetUnits,
        maxX: centerX + bufferInTargetUnits,
        maxY: centerY + bufferInTargetUnits
    };

    // Call the callback to visualize bbox (only called once per query)
    if (onBboxCalculated) {
        onBboxCalculated(bbox, crs);
    }

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('version', '2.0.0');
    params.set('request', 'GetFeature');
    params.set('typeNames', layers.join(','));
    params.set('outputFormat', 'application/json');
    params.set('count', featureCount.toString());

    // Use bbox parameter for spatial filtering - properly handles CRS transformation
    // Format: minx,miny,maxx,maxy,CRS (GeoServer handles CRS conversion automatically)
    params.set('bbox', `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY},${crs}`);

    // Add attribute filter if provided (separate from spatial bbox)
    if (cql_filter) {
        const normalizedAttributeFilter = cql_filter.trim().replace(/\s*=\s*/g, '=');
        params.set('cql_filter', normalizedAttributeFilter);
    }

    const fullUrl = `${url}?${params.toString()}`;

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

            const featuresWithNamespace = data.features.map((feature: Feature) => {
                const layerName = feature.id ? String(feature.id).split('.')[0] : '';
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

/**
 * WFS GetFeature query using polygon geometry
 * Uses WKT (Well-Known Text) in CQL filter for spatial intersection
 */
interface WFSPolygonQueryProps {
    polygonRings: number[][][];
    layers: string[];
    url: string;
    cql_filter?: string | null;
    crs?: string;
    featureCount?: number;
}

// Cache for geometry field names per layer
const geometryFieldCache = new Map<string, string | null>();

async function getGeometryFieldName(layer: string, wfsUrl: string): Promise<string | null> {
    // Check cache first
    if (geometryFieldCache.has(layer)) {
        return geometryFieldCache.get(layer)!;
    }

    // Try to get from DescribeFeatureType
    try {
        const params = new URLSearchParams();
        params.set('service', 'WFS');
        params.set('version', '2.0.0');
        params.set('request', 'DescribeFeatureType');
        params.set('typeName', layer);
        params.set('outputFormat', 'application/json');

        const response = await fetch(`${wfsUrl}?${params.toString()}`);
        if (response.ok) {
            const data = await response.json();
            // console.log(`[GetGeometryFieldName] DescribeFeatureType response for ${layer}:`, data);

            // Look for geometry type properties
            // GeoServer returns types like "gml:MultiPolygon", "gml:LineString", etc.
            const geometryLocalTypes = ['MultiPolygon', 'Polygon', 'MultiLineString', 'LineString', 'Point', 'MultiPoint', 'Geometry', 'GeometryCollection'];

            if (data.featureTypes && data.featureTypes[0] && data.featureTypes[0].properties) {
                // console.log(`[GetGeometryFieldName] Properties:`, data.featureTypes[0].properties);
                for (const prop of data.featureTypes[0].properties) {
                    // Check if the type starts with "gml:" and localType is a known geometry type
                    if (prop.type?.startsWith('gml:') && geometryLocalTypes.includes(prop.localType)) {
                        const fieldName = prop.name;
                        geometryFieldCache.set(layer, fieldName);
                        return fieldName;
                    }
                }
            }
        } else {
            console.warn(`[GetGeometryFieldName] DescribeFeatureType request failed with status ${response.status}`);
        }
    } catch (error) {
        console.warn('[GetGeometryFieldName] Could not get geometry field from DescribeFeatureType:', error);
    }

    // Could not determine geometry field name - return null to signal bbox fallback
    geometryFieldCache.set(layer, null);
    return null;
}

export async function fetchWFSFeatureByPolygon({
    polygonRings,
    layers,
    url,
    cql_filter = null,
    crs: _crs = 'EPSG:4326', // CRS param kept for API compatibility but always queries in 4326
    featureCount = 200
}: WFSPolygonQueryProps): Promise<GeoServerGeoJSON | null> {
    if (layers.length === 0) {
        console.warn('No layers specified for WFS polygon query.');
        return null;
    }

    if (!polygonRings || polygonRings.length === 0 || !polygonRings[0]) {
        console.warn('No polygon geometry provided for WFS query.');
        return null;
    }

    // Use bbox parameter for reliable CRS handling, then filter client-side for polygon intersection
    // CQL_FILTER with WKT polygons fails with SRID mismatch errors across different CRS
    const ring = polygonRings[0]; // Use first ring (exterior ring)

    // Compute bounding box from polygon (in WGS84)
    const lngs = ring.map(([lng]) => lng);
    const lats = ring.map(([, lat]) => lat);
    const bbox = {
        minX: Math.min(...lngs),
        minY: Math.min(...lats),
        maxX: Math.max(...lngs),
        maxY: Math.max(...lats)
    };

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('version', '2.0.0');
    params.set('request', 'GetFeature');
    params.set('typeNames', layers.join(','));
    params.set('outputFormat', 'application/json');
    params.set('count', featureCount.toString());

    // Use bbox parameter - works reliably with any CRS
    params.set('bbox', `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY},EPSG:4326`);
    // Request results in 4326 for client-side polygon filtering
    params.set('srsName', 'EPSG:4326');

    // Add attribute filter if provided
    if (cql_filter) {
        params.set('cql_filter', cql_filter.trim());
    }

    const fullUrl = `${url}?${params.toString()}`;

    try {
        const response = await fetch(fullUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[FetchWFSFeatureByPolygon] Request failed with status:', response.status);
            console.error('[FetchWFSFeatureByPolygon] Error response:', errorText);
            throw new Error(`WFS polygon query failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.features && data.features.length > 0) {
            // Create turf polygon for intersection testing (close the ring if needed)
            const closedRing = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
                ? ring
                : [...ring, ring[0]];
            const queryPolygon = turfPolygon([closedRing]);

            // Filter features to only those that actually intersect the query polygon
            const intersectingFeatures = data.features.filter((feature: Feature) => {
                if (!feature.geometry) return false;
                try {
                    return booleanIntersects(feature, queryPolygon);
                } catch {
                    // If intersection test fails, include the feature (conservative)
                    return true;
                }
            });

            // Add namespace to features for consistency
            const namespaceMap = layers.reduce((acc, layer) => {
                const [namespace, layerName] = layer.split(':');
                if (namespace && layerName) {
                    acc[layerName] = namespace;
                }
                return acc;
            }, {} as Record<string, string>);

            const featuresWithNamespace = intersectingFeatures.map((feature: Feature) => {
                const layerName = feature.id ? String(feature.id).split('.')[0] : '';
                const namespace = namespaceMap[layerName] || null;
                return {
                    ...feature,
                    namespace,
                };
            });

            return { ...data, features: featuresWithNamespace, totalFeatures: featuresWithNamespace.length };
        }

        return data;
    } catch (error) {
        console.error('[FetchWFSFeatureByPolygon] Error:', error);
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
    const [polygonRings, setPolygonRings] = useState<number[][][] | null>(null);
    const { activeFilters } = useLayerUrl();

    // Track unique click IDs - increment on each new click
    const clickIdRef = useRef(0);
    const [currentClickId, setCurrentClickId] = useState<number | null>(null);

    // Query bbox visualizer for debugging
    const { showQueryBbox, hideQueryBbox } = useQueryBboxVisualizer(map);

    const queryFn = async (): Promise<LayerContentProps[]> => {
        if (!map) {
            return [];
        }

        // Determine query type
        const isPolygonQuery = polygonRings !== null;
        const isPointQuery = mapPoint !== null;

        if (!isPolygonQuery && !isPointQuery) {
            return [];
        }

        const queryableLayers = Object.entries(visibleLayersMap)
            .filter(([_, layerInfo]) => layerInfo.visible && layerInfo.queryable)
            .map(([key]) => key);


        if (queryableLayers.length === 0) {
            // console.log('[FeatureInfoQuery] No queryable layers');
            return [];
        }

        // Click tolerance buffer: sqrt(resolution) * 50 for gradual scaling across zoom levels
        const resolution = coordinateAdapter.getResolution(map);
        const bufferMeters = Math.sqrt(resolution) * 50;

        // Query each layer separately (WMS renders layers stacked, only returns top layer)
        const allFeatures: Feature[] = [];

        // Track if we've shown bbox yet (only show once per query)
        let bboxShown = false;

        for (const layerKey of queryableLayers) {
            const layerConfig = visibleLayersMap[layerKey];


            const layerCrs = layerConfig?.layerCrs || 'EPSG:3857';

            // Get the CQL filter for this specific layer
            const layerTitle = getLayerTitle(layerConfig);
            const staticFilter = getStaticCqlFilter(layerConfig);
            const dynamicFilter = activeFilters && activeFilters[layerTitle];

            const layerFilters: string[] = [];
            if (staticFilter) layerFilters.push(staticFilter);
            if (dynamicFilter) layerFilters.push(dynamicFilter);
            const layerCqlFilter = layerFilters.length > 0 ? layerFilters.join(' AND ') : null;

            // Check if this is a PMTiles layer (prefixed with 'pmtiles:')
            if (layerKey.startsWith('pmtiles:')) {
                // PMTiles: Use queryRenderedFeatures for client-side vector tiles
                if (isPointQuery && mapPoint) {
                    const sourceLayerName = layerKey.replace('pmtiles:', '');

                    // Convert map point to screen coordinates
                    const screenPoint = map.project([mapPoint.x, mapPoint.y]);

                    // Calculate tolerance in pixels based on the same buffer as WFS
                    const tolerancePixels = Math.ceil(bufferMeters / resolution);

                    // Calculate query bbox in screen pixels
                    const queryBbox: [[number, number], [number, number]] = [
                        [screenPoint.x - tolerancePixels, screenPoint.y - tolerancePixels],
                        [screenPoint.x + tolerancePixels, screenPoint.y + tolerancePixels]
                    ];

                    // Calculate geographic bbox for visualization and intersection testing
                    const sw = map.unproject([screenPoint.x - tolerancePixels, screenPoint.y + tolerancePixels]);
                    const ne = map.unproject([screenPoint.x + tolerancePixels, screenPoint.y - tolerancePixels]);
                    const geoBbox = {
                        minX: sw.lng,
                        minY: sw.lat,
                        maxX: ne.lng,
                        maxY: ne.lat
                    };

                    // Create turf polygon for intersection testing (matches WFS INTERSECTS behavior)
                    const bboxPolygon = turfPolygon([[
                        [geoBbox.minX, geoBbox.minY],
                        [geoBbox.maxX, geoBbox.minY],
                        [geoBbox.maxX, geoBbox.maxY],
                        [geoBbox.minX, geoBbox.maxY],
                        [geoBbox.minX, geoBbox.minY]
                    ]]);

                    // Show bbox visualization for PMTiles
                    if (!bboxShown) {
                        bboxShown = true;
                        showQueryBbox(geoBbox, 'EPSG:4326', true);
                    }

                    // Get all PMTiles layers for this source
                    const style = map.getStyle();
                    const pmtilesLayerIds = style?.layers
                        ?.filter(l => l.id.includes('pmtiles-') && 'source-layer' in l && l['source-layer'] === sourceLayerName)
                        .map(l => l.id) || [];

                    if (pmtilesLayerIds.length > 0) {
                        // queryRenderedFeatures already handles circle/symbol layers correctly
                        // (it considers the visual bounds, not just the point geometry)
                        const candidateFeatures = map.queryRenderedFeatures(queryBbox, { layers: pmtilesLayerIds });

                        for (const feature of candidateFeatures) {
                            // For point geometries (circles, symbols), skip intersection check
                            // since queryRenderedFeatures already matched the visual representation
                            const isPointGeometry = feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint';

                            if (isPointGeometry) {
                                // Include all point features returned by queryRenderedFeatures
                                const geoJsonFeature: Feature = {
                                    type: 'Feature',
                                    id: `${sourceLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                    geometry: feature.geometry,
                                    properties: feature.properties,
                                };
                                allFeatures.push(geoJsonFeature);
                            } else {
                                // For polygon/line geometries, use intersection check
                                try {
                                    if (booleanIntersects(feature.geometry, bboxPolygon)) {
                                        const geoJsonFeature: Feature = {
                                            type: 'Feature',
                                            id: `${sourceLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                            geometry: feature.geometry,
                                            properties: feature.properties,
                                        };
                                        allFeatures.push(geoJsonFeature);
                                    }
                                } catch {
                                    // If intersection check fails, include the feature anyway
                                    const geoJsonFeature: Feature = {
                                        type: 'Feature',
                                        id: `${sourceLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                        geometry: feature.geometry,
                                        properties: feature.properties,
                                    };
                                    allFeatures.push(geoJsonFeature);
                                }
                            }
                        }
                    }
                }
                // Skip server-side WFS query for PMTiles
                continue;
            }

            // Check if this is a client-side WFS layer (prefixed with 'wfs:')
            if (layerKey.startsWith('wfs:')) {
                // WFS vector layer: Use queryRenderedFeatures for client-side query
                if (isPointQuery && mapPoint) {
                    const wfsLayerName = layerKey.replace('wfs:', '');

                    // Convert map point to screen coordinates
                    const screenPoint = map.project([mapPoint.x, mapPoint.y]);

                    // Calculate tolerance in pixels based on the same buffer as WFS
                    const tolerancePixels = Math.ceil(bufferMeters / resolution);

                    // Calculate query bbox in screen pixels
                    const queryBbox: [[number, number], [number, number]] = [
                        [screenPoint.x - tolerancePixels, screenPoint.y - tolerancePixels],
                        [screenPoint.x + tolerancePixels, screenPoint.y + tolerancePixels]
                    ];

                    // Calculate geographic bbox for visualization
                    const sw = map.unproject([screenPoint.x - tolerancePixels, screenPoint.y + tolerancePixels]);
                    const ne = map.unproject([screenPoint.x + tolerancePixels, screenPoint.y - tolerancePixels]);
                    const geoBbox = {
                        minX: sw.lng,
                        minY: sw.lat,
                        maxX: ne.lng,
                        maxY: ne.lat
                    };

                    // Create turf polygon for intersection testing
                    const bboxPolygon = turfPolygon([[
                        [geoBbox.minX, geoBbox.minY],
                        [geoBbox.maxX, geoBbox.minY],
                        [geoBbox.maxX, geoBbox.maxY],
                        [geoBbox.minX, geoBbox.maxY],
                        [geoBbox.minX, geoBbox.minY]
                    ]]);

                    // Show bbox visualization for WFS
                    if (!bboxShown) {
                        bboxShown = true;
                        showQueryBbox(geoBbox, 'EPSG:4326', true);
                    }

                    // Find all WFS layers with this name in the map style
                    const style = map.getStyle();
                    const sourceId = `wfs-${layerConfig.layerTitle || 'layer'}`.replace(/\s+/g, '-').toLowerCase();
                    const wfsLayerIds = style?.layers
                        ?.filter(l => l.id.startsWith(sourceId))
                        .map(l => l.id) || [];

                    if (wfsLayerIds.length > 0) {
                        // queryRenderedFeatures handles circle/symbol layers correctly
                        const candidateFeatures = map.queryRenderedFeatures(queryBbox, { layers: wfsLayerIds });

                        for (const feature of candidateFeatures) {
                            // For point geometries, skip intersection check
                            const isPointGeometry = feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint';

                            if (isPointGeometry) {
                                // Include all point features returned by queryRenderedFeatures
                                const geoJsonFeature: Feature = {
                                    type: 'Feature',
                                    id: `${wfsLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                    geometry: feature.geometry,
                                    properties: feature.properties,
                                };
                                allFeatures.push(geoJsonFeature);
                            } else {
                                // For polygon/line geometries, use intersection check
                                try {
                                    if (booleanIntersects(feature.geometry, bboxPolygon)) {
                                        const geoJsonFeature: Feature = {
                                            type: 'Feature',
                                            id: `${wfsLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                            geometry: feature.geometry,
                                            properties: feature.properties,
                                        };
                                        allFeatures.push(geoJsonFeature);
                                    }
                                } catch {
                                    // If intersection check fails, include the feature anyway
                                    const geoJsonFeature: Feature = {
                                        type: 'Feature',
                                        id: `${wfsLayerName}.${feature.id || Math.random().toString(36).substr(2, 9)}`,
                                        geometry: feature.geometry,
                                        properties: feature.properties,
                                    };
                                    allFeatures.push(geoJsonFeature);
                                }
                            }
                        }
                    }
                }
                // Skip server-side WFS query for client-side WFS layers
                continue;
            }

            // Use WFS instead of WMS for more reliable geometry-based queries
            const wfsUrl = wmsUrl.replace('/wms', '/wfs');

            // Show bbox for the first layer queried (point queries only)
            const shouldShowBbox = isPointQuery && !bboxShown;

            let featureInfo;
            if (isPolygonQuery && polygonRings) {
                // Polygon-based query
                featureInfo = await fetchWFSFeatureByPolygon({
                    polygonRings,
                    layers: [layerKey],
                    url: wfsUrl,
                    cql_filter: layerCqlFilter,
                    crs: layerCrs,
                    featureCount: 200
                });
            } else if (isPointQuery && mapPoint) {
                // Point-based query - show bbox visualization for first layer
                featureInfo = await fetchWFSFeature({
                    mapPoint,
                    layers: [layerKey],
                    url: wfsUrl,
                    cql_filter: layerCqlFilter,
                    crs: layerCrs,
                    featureCount: 50,
                    bufferMeters,
                    onBboxCalculated: shouldShowBbox ? (bbox, crs) => {
                        bboxShown = true;
                        showQueryBbox(bbox, crs, true); // persist=true to keep visible
                    } : undefined
                });
            }

            if (featureInfo && 'features' in featureInfo && featureInfo.features && featureInfo.features.length > 0) {
                allFeatures.push(...featureInfo.features);
            }
        }

        if (allFeatures.length === 0) {
            return [];
        }

        const featureInfo = { features: allFeatures };
        // console.log('[FeatureInfoQuery] Total features from all layers:', allFeatures.length);

        const layerInfoPromises = Object.entries(visibleLayersMap)
            .filter(([_, value]) => value.visible)
            .map(async ([key, value]) => {
                const matchingFeatures = featureInfo.features.filter((feature: Feature) => {
                    const featureId = feature.id?.toString() || '';

                    // Extract layer name from key (handles both "namespace:layer" and "pmtiles:layer" formats)
                    const keyParts = key.split(':');
                    const layerName = keyParts.length >= 2 ? keyParts[1] : key;

                    // Feature IDs are formatted as "layerName.featureId" (both GeoServer WFS and our PMTiles IDs)
                    // Use exact prefix match to avoid cross-matching between layers with similar names
                    return featureId.startsWith(`${layerName}.`);
                });

                const baseLayerInfo = {
                    customLayerParameters: value.customLayerParameters,
                    visible: value.visible,
                    layerTitle: value.layerTitle,
                    groupLayerTitle: value.groupLayerTitle,
                    sourceCRS: value.layerCrs || 'EPSG:4326',
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

                // Raster queries only supported for point queries
                if (value.rasterSource && isPointQuery && mapPoint) {
                    const rasterFeatureInfo = await fetchWMSFeatureInfo({
                        mapPoint,
                        map,
                        layers: [value.rasterSource.layerName],
                        url: value.rasterSource.url,
                        coordinateAdapter
                    });
                    // WMS feature info always returns a FeatureCollection or null
                    const rasterData = (rasterFeatureInfo && 'features' in rasterFeatureInfo) ? rasterFeatureInfo : null;
                    baseLayerInfo.rasterSource = { ...value.rasterSource, data: rasterData };
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
        queryKey: queryKeys.features.wmsInfo(coordinateAdapter.toJSON(mapPoint), polygonRings, currentClickId),
        queryFn,
        enabled: false,
        refetchOnWindowFocus: false,
    });

    const fetchForPoint = (point: MapPoint) => {
        // Clear polygon state when doing point query
        setPolygonRings(null);
        // Generate new click ID for each map click
        clickIdRef.current += 1;
        setCurrentClickId(clickIdRef.current);
        setMapPoint(point);
    };

    const fetchForPolygon = (rings: number[][][]) => {
        // Clear point state when doing polygon query
        setMapPoint(null);
        // Generate new query ID
        clickIdRef.current += 1;
        const newClickId = clickIdRef.current;
        setCurrentClickId(newClickId);
        setPolygonRings(rings);
    };

    // trigger refetch when query geometry changes
    useEffect(() => {
        if ((mapPoint || polygonRings) && currentClickId !== null) {
            refetch();
        }
    }, [mapPoint, polygonRings, currentClickId, refetch]);

    return {
        fetchForPoint,
        fetchForPolygon,
        data: isSuccess ? data : [],
        isFetching,
        isSuccess,
        lastClickedPoint: mapPoint || undefined,
        isPolygonQuery: polygonRings !== null,
        clickId: currentClickId,
        hideQueryBbox,
    };
}