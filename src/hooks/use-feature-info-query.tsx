import { useQuery } from '@tanstack/react-query';
import { useState, useRef, useMemo } from 'react';
import { Feature } from 'geojson';
import { LayerOrderConfig } from "@/hooks/use-get-layer-configs";
import { LayerContentProps } from '@/components/maps/popups/popup-content-with-pagination';
import type { VisibleLayersMap, VisibleLayerInfo } from '@/lib/map/layer-info-utils';
import { useLayerUrl } from '@/context/layer-url-provider';
import type { MapPoint, CoordinateAdapter } from '@/lib/map/coordinates/types';
import { GeoServerGeoJSON } from '@/lib/types/geoserver-types';
import type { ProcessedRasterSource } from '@/lib/types/mapping-types';
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

async function fetchWMSFeatureInfo({
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

// Cache for geometry field names per layer with TTL and max size
interface CacheEntry {
    field: string;
    timestamp: number;
}
const geometryFieldCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 100;

/**
 * Get the geometry field name for a layer via DescribeFeatureType
 * Returns 'shape' as fallback if detection fails
 */
async function getGeometryFieldName(layer: string, wfsUrl: string): Promise<string> {
    const now = Date.now();

    // Check cache first (with TTL validation)
    const cached = geometryFieldCache.get(layer);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        return cached.field;
    }

    try {
        const params = new URLSearchParams({
            service: 'WFS',
            version: '2.0.0',
            request: 'DescribeFeatureType',
            typeName: layer,
            outputFormat: 'application/json'
        });

        const response = await fetch(`${wfsUrl}?${params.toString()}`);
        if (response.ok) {
            const data = await response.json();
            const geometryTypes = ['MultiPolygon', 'Polygon', 'MultiLineString', 'LineString', 'Point', 'MultiPoint', 'Geometry'];

            if (data.featureTypes?.[0]?.properties) {
                for (const prop of data.featureTypes[0].properties) {
                    if (prop.type?.startsWith('gml:') && geometryTypes.includes(prop.localType)) {
                        // Evict oldest entry if cache is full
                        if (geometryFieldCache.size >= MAX_CACHE_SIZE) {
                            const firstKey = geometryFieldCache.keys().next().value;
                            if (firstKey) geometryFieldCache.delete(firstKey);
                        }
                        geometryFieldCache.set(layer, { field: prop.name, timestamp: now });
                        return prop.name;
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[GetGeometryFieldName] Failed to detect geometry field:', error);
    }

    // Fallback to 'shape' (common default)
    if (geometryFieldCache.size >= MAX_CACHE_SIZE) {
        const firstKey = geometryFieldCache.keys().next().value;
        if (firstKey) geometryFieldCache.delete(firstKey);
    }
    geometryFieldCache.set(layer, { field: 'shape', timestamp: now });
    return 'shape';
}

/**
 * WFS GetFeature query for geometry-based feature retrieval
 * More reliable than WMS GetFeatureInfo for line and polygon features
 */
interface WFSQueryProps {
    /** Pre-computed bounding box in WGS84 (use coordinateAdapter.createBoundingBox for accuracy) */
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    layers: string[];
    url: string;
    cql_filter?: string | null;
    featureCount?: number;
}

async function fetchWFSFeature({
    bbox,
    layers,
    url,
    cql_filter = null,
    featureCount = 50,
}: WFSQueryProps): Promise<GeoServerGeoJSON | null> {
    if (layers.length === 0) {
        console.warn('No layers specified for WFS query.');
        return null;
    }

    // Get the geometry field name for this layer (cached after first call)
    const geometryField = await getGeometryFieldName(layers[0], url);

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('version', '2.0.0');
    params.set('request', 'GetFeature');
    params.set('typeNames', layers.join(','));
    params.set('outputFormat', 'application/json');
    params.set('count', featureCount.toString());
    // Request results in 4326 for consistency
    params.set('srsName', 'EPSG:4326');

    // Build CQL_FILTER with BBOX function - allows combining spatial and attribute filters
    // GeoServer doesn't allow bbox parameter + cql_filter together (mutually exclusive)
    // Using BBOX() in CQL_FILTER works reliably with EPSG:4326 coordinates
    const bboxCql = `BBOX(${geometryField},${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY},'EPSG:4326')`;

    if (cql_filter) {
        // Combine spatial bbox with attribute filter
        const normalizedAttributeFilter = cql_filter.trim().replace(/\s*=\s*/g, '=');
        params.set('cql_filter', `${bboxCql} AND ${normalizedAttributeFilter}`);
    } else {
        // Just spatial filter
        params.set('cql_filter', bboxCql);
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
    featureCount?: number;
}


async function fetchWFSFeatureByPolygon({
    polygonRings,
    layers,
    url,
    cql_filter = null,
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

    const ring = polygonRings[0]; // Use first ring (exterior ring)

    // Ensure ring is closed for WKT format
    const closedRing = (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1])
        ? ring
        : [...ring, ring[0]];

    // Convert polygon to WKT format for CQL_FILTER INTERSECTS
    // Format: POLYGON((lng1 lat1, lng2 lat2, ...))
    const wktCoords = closedRing.map(([lng, lat]) => `${lng} ${lat}`).join(', ');
    const wktPolygon = `POLYGON((${wktCoords}))`;

    // Get the geometry field name for this layer (cached after first call)
    const geometryField = await getGeometryFieldName(layers[0], url);

    const params = new URLSearchParams();
    params.set('service', 'WFS');
    params.set('version', '2.0.0');
    params.set('request', 'GetFeature');
    params.set('typeNames', layers.join(','));
    params.set('outputFormat', 'application/json');
    params.set('count', featureCount.toString());
    params.set('srsName', 'EPSG:4326');

    // Use CQL_FILTER with INTERSECTS - server does spatial filtering
    // This is much faster than downloading all bbox features and filtering client-side
    const intersectsCql = `INTERSECTS(${geometryField}, ${wktPolygon})`;

    if (cql_filter) {
        // Combine spatial filter with attribute filter
        params.set('cql_filter', `${intersectsCql} AND ${cql_filter.trim()}`);
    } else {
        params.set('cql_filter', intersectsCql);
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
            // Add namespace to features for consistency
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
 * Get layer title from layer info.
 */
function getLayerTitle(layer: VisibleLayerInfo): string {
    return layer.layerTitle?.trim() || layer.groupLayerTitle?.trim() || "Unnamed Layer";
}

/**
 * Get static CQL filter from layer info.
 */
function getStaticCqlFilter(layer: VisibleLayerInfo): string | null {
    if (!layer) return null;
    const params = layer.customLayerParameters as { cql_filter?: string } | undefined;
    return params?.cql_filter || null;
}

interface UseFeatureInfoQueryProps {
    map: MapLibreMap;
    wmsUrl: string;
    visibleLayersMap: VisibleLayersMap;
    layerOrderConfigs: LayerOrderConfig[];
    coordinateAdapter: CoordinateAdapter;
    /** Initial popup coords from URL - query runs automatically when present */
    initialPopupCoords?: { lat: number; lon: number } | null;
}

export function useFeatureInfoQuery({
    map,
    wmsUrl,
    visibleLayersMap,
    layerOrderConfigs,
    coordinateAdapter,
    initialPopupCoords
}: UseFeatureInfoQueryProps) {
    // Initialize mapPoint from URL coords if present
    const [mapPoint, setMapPoint] = useState<MapPoint | null>(() =>
        initialPopupCoords ? { x: initialPopupCoords.lon, y: initialPopupCoords.lat } : null
    );
    const [polygonRings, setPolygonRings] = useState<number[][][] | null>(null);
    const { activeFilters } = useLayerUrl();

    // Track unique click IDs - increment on each new click
    // Start at 1 if we have initial coords so query runs on mount
    const clickIdRef = useRef(initialPopupCoords ? 1 : 0);
    const [currentClickId, setCurrentClickId] = useState<number | null>(initialPopupCoords ? 1 : null);

    // Accumulated data for shift+click - merges features instead of replacing
    const [accumulatedData, setAccumulatedData] = useState<LayerContentProps[]>([]);
    const pendingAdditiveRef = useRef(false);
    const lastProcessedClickIdRef = useRef<number | null>(null);

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

        // Click tolerance: sqrt(resolution) * 50 pixels for gradual scaling across zoom levels
        const resolution = coordinateAdapter.getResolution(map);
        const bufferPixels = Math.ceil(Math.sqrt(resolution) * 50 / resolution);

        // Compute bbox once using accurate map projection (reused for all WFS queries)
        let queryBbox: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
        if (isPointQuery && mapPoint) {
            queryBbox = coordinateAdapter.createBoundingBox({ mapPoint, buffer: bufferPixels, map });
        }

        // Query each layer separately (WMS renders layers stacked, only returns top layer)
        const allFeatures: Feature[] = [];

        // Track if we've shown bbox yet (only show once per query)
        let bboxShown = false;

        for (const layerKey of queryableLayers) {
            const layerConfig = visibleLayersMap[layerKey];

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
                if (isPointQuery && mapPoint && queryBbox) {
                    const sourceLayerName = layerKey.replace('pmtiles:', '');

                    // Convert map point to screen coordinates for queryRenderedFeatures
                    const screenPoint = map.project([mapPoint.x, mapPoint.y]);

                    // Screen pixel bbox for queryRenderedFeatures
                    const screenBbox: [[number, number], [number, number]] = [
                        [screenPoint.x - bufferPixels, screenPoint.y - bufferPixels],
                        [screenPoint.x + bufferPixels, screenPoint.y + bufferPixels]
                    ];

                    // Create turf polygon for intersection testing using pre-computed queryBbox
                    const bboxPolygon = turfPolygon([[
                        [queryBbox.minX, queryBbox.minY],
                        [queryBbox.maxX, queryBbox.minY],
                        [queryBbox.maxX, queryBbox.maxY],
                        [queryBbox.minX, queryBbox.maxY],
                        [queryBbox.minX, queryBbox.minY]
                    ]]);

                    // Show bbox visualization for PMTiles
                    if (!bboxShown) {
                        bboxShown = true;
                        showQueryBbox(queryBbox, 'EPSG:4326', true);
                    }

                    // Get all PMTiles layers for this source
                    const style = map.getStyle();
                    const pmtilesLayerIds = style?.layers
                        ?.filter(l => l.id.includes('pmtiles-') && 'source-layer' in l && l['source-layer'] === sourceLayerName)
                        .map(l => l.id) || [];

                    if (pmtilesLayerIds.length > 0) {
                        // queryRenderedFeatures already handles circle/symbol layers correctly
                        // (it considers the visual bounds, not just the point geometry)
                        const candidateFeatures = map.queryRenderedFeatures(screenBbox, { layers: pmtilesLayerIds });

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
                // Use server-side WFS query if wfsUrl and typeName are available
                // This ensures queries work even when the query location is outside the viewport
                const wfsUrl = layerConfig.wfsUrl;
                const typeName = layerConfig.typeName;

                if (wfsUrl && typeName) {
                    // Show bbox for the first layer queried (point queries only)
                    const shouldShowBbox = isPointQuery && !bboxShown;

                    let featureInfo;
                    if (isPolygonQuery && polygonRings) {
                        // Polygon-based query
                        featureInfo = await fetchWFSFeatureByPolygon({
                            polygonRings,
                            layers: [typeName],
                            url: wfsUrl,
                            cql_filter: layerCqlFilter,
                            featureCount: 200
                        });
                    } else if (isPointQuery && mapPoint && queryBbox) {
                        // Show bbox visualization for first layer
                        if (shouldShowBbox) {
                            bboxShown = true;
                            showQueryBbox(queryBbox, 'EPSG:4326', true);
                        }
                        // Point-based query with pre-computed bbox
                        featureInfo = await fetchWFSFeature({
                            bbox: queryBbox,
                            layers: [typeName],
                            url: wfsUrl,
                            cql_filter: layerCqlFilter,
                            featureCount: 50,
                        });
                    }

                    if (featureInfo && 'features' in featureInfo && featureInfo.features && featureInfo.features.length > 0) {
                        // Features from WFS already have IDs like "layerName.featureId"
                        // Don't remap - just push them directly
                        allFeatures.push(...featureInfo.features);
                    }
                }
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
                    featureCount: 200
                });
            } else if (isPointQuery && mapPoint && queryBbox) {
                // Show bbox visualization for first layer
                if (shouldShowBbox) {
                    bboxShown = true;
                    showQueryBbox(queryBbox, 'EPSG:4326', true);
                }
                // Point-based query with pre-computed bbox
                featureInfo = await fetchWFSFeature({
                    bbox: queryBbox,
                    layers: [layerKey],
                    url: wfsUrl,
                    cql_filter: layerCqlFilter,
                    featureCount: 50,
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

                // Process raster source if available (point queries only)
                let processedRasterSource: ProcessedRasterSource | undefined;
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
                    processedRasterSource = { ...value.rasterSource, data: rasterData };
                }

                const baseLayerInfo = {
                    customLayerParameters: value.customLayerParameters,
                    visible: value.visible,
                    layerTitle: value.layerTitle,
                    groupLayerTitle: value.groupLayerTitle,
                    // WFS queries always return EPSG:4326 (srsName=EPSG:4326)
                    sourceCRS: 'EPSG:4326',
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
                    rasterSource: processedRasterSource,
                };

                return baseLayerInfo as LayerContentProps;
            });

        const resolvedLayerInfo = await Promise.all(layerInfoPromises);

        const layerInfoFiltered = resolvedLayerInfo.filter(layer => layer.features.length > 0);
        // console.log('[FeatureInfoQuery] Layers with features:', layerInfoFiltered.map(l => ({ title: l.layerTitle, count: l.features.length })));

        return layerOrderConfigs.length > 0
            ? reorderLayers(layerInfoFiltered, layerOrderConfigs)
            : layerInfoFiltered;
    };

    // Check if we have queryable layers
    const hasQueryableLayers = Object.values(visibleLayersMap)
        .some(layerInfo => layerInfo.visible && layerInfo.queryable);

    // Declarative query - enabled when we have geometry + queryable layers
    const { data: rawData, isFetching, isSuccess } = useQuery({
        queryKey: queryKeys.features.wmsInfo(coordinateAdapter.toJSON(mapPoint), polygonRings, currentClickId),
        queryFn,
        enabled: !!map && !!(mapPoint || polygonRings) && currentClickId !== null && hasQueryableLayers,
        refetchOnWindowFocus: false,
    });

    // Process query results - update accumulated data only once per click
    const data = useMemo(() => {
        // No raw data yet, return accumulated
        if (!rawData || !isSuccess) return accumulatedData;

        // Already processed this click, return current accumulated
        if (lastProcessedClickIdRef.current === currentClickId) {
            return accumulatedData;
        }

        // Mark as processed
        lastProcessedClickIdRef.current = currentClickId;

        if (!pendingAdditiveRef.current) {
            // Replace mode - update accumulated and return new data
            // Use queueMicrotask to avoid state update during render
            queueMicrotask(() => setAccumulatedData(rawData));
            return rawData;
        }

        // Additive mode - merge with accumulated data
        const result: LayerContentProps[] = [];

        for (const newLayer of rawData) {
            const existingLayerIndex = accumulatedData.findIndex(l => l.layerTitle === newLayer.layerTitle);

            if (existingLayerIndex >= 0) {
                const existingLayer = accumulatedData[existingLayerIndex];
                const existingIds = new Set(existingLayer.features.map(f => f.id?.toString()));
                const newIds = new Set(newLayer.features.map(f => f.id?.toString()));

                // Toggle: keep features not in new, add features not in existing
                const remainingFeatures = existingLayer.features.filter(f => !newIds.has(f.id?.toString()));
                const addedFeatures = newLayer.features.filter(f => !existingIds.has(f.id?.toString()));

                const mergedFeatures = [...remainingFeatures, ...addedFeatures];
                if (mergedFeatures.length > 0) {
                    result.push({ ...newLayer, features: mergedFeatures });
                }
            } else {
                result.push(newLayer);
            }
        }

        // Keep layers from accumulated that aren't in new data
        for (const prevLayer of accumulatedData) {
            if (!rawData.some(l => l.layerTitle === prevLayer.layerTitle)) {
                result.push(prevLayer);
            }
        }

        // Update accumulated and return merged
        queueMicrotask(() => setAccumulatedData(result));
        return result;
    }, [rawData, accumulatedData, isSuccess, currentClickId]);

    const fetchForPoint = (point: MapPoint, options?: { additive?: boolean }) => {
        const additive = options?.additive ?? false;
        pendingAdditiveRef.current = additive;

        // If not additive, clear accumulated data
        if (!additive) {
            setAccumulatedData([]);
        }

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

    // Clear accumulated data helper
    const clearAccumulatedData = () => {
        setAccumulatedData([]);
    };

    return {
        fetchForPoint,
        fetchForPolygon,
        data,
        isFetching,
        isSuccess,
        lastClickedPoint: mapPoint || undefined,
        isPolygonQuery: polygonRings !== null,
        clickId: currentClickId,
        hideQueryBbox,
        clearAccumulatedData,
    };
}