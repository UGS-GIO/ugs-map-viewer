import { useMemo } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

// Import the existing hazard layer map
import { hazardLayerNameMap as importedHazardLayerNameMap } from '@/routes/_report/-data/hazard-unit-map';
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { useReportMap } from '@/routes/_report/-hooks/use-report-map';
// Type it properly for indexing
const hazardLayerNameMap: Record<string, string> = importedHazardLayerNameMap as Record<string, string>;

interface ReportMapProps {
    title?: string;
    polygon?: string;
    hazardCodes?: string[];
    height?: number;
    showControls?: boolean;
    geoserverUrl?: string; // Allow override
}

// Parse polygon coordinates
function parsePolygonCoordinates(polygon: string | undefined): number[][] | null {
    if (!polygon) return null;

    try {
        const parsed = JSON.parse(polygon);

        // Handle polygon format with CRS: { crs: "EPSG:...", rings: [[[x, y], ...]] }
        if (parsed.rings && Array.isArray(parsed.rings[0])) {
            const coords = parsed.rings[0];
            const sourceCRS = parsed.crs || 'EPSG:4326'; // Default to WGS84

            // Convert to WGS84 if not already
            if (sourceCRS !== 'EPSG:4326') {
                // Web Mercator to WGS84 conversion
                if (sourceCRS === 'EPSG:3857') {
                    return coords.map(([x, y]: number[]) => {
                        const lng = (x / 20037508.34) * 180;
                        const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
                        return [lng, lat];
                    });
                }

                // If it's a different projection, log a warning
                console.warn(`Polygon is in ${sourceCRS}. Automatic conversion only supported for Web Mercator (EPSG:3857).`);
            }

            return coords;
        }

        // Handle different formats:
        // 1. Already an array of coordinates: [[lng, lat], [lng, lat], ...]
        if (Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') {
            return parsed;
        }

        // 2. GeoJSON Polygon: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
            return parsed.coordinates[0];
        }

        // 3. Nested array (Polygon coordinates): [[[lng, lat], [lng, lat], ...]]
        if (Array.isArray(parsed[0]?.[0]) && typeof parsed[0][0][0] === 'number') {
            return parsed[0];
        }

        // 4. GeoJSON Feature with Polygon geometry
        if (parsed.geometry?.type === 'Polygon' && Array.isArray(parsed.geometry.coordinates?.[0])) {
            return parsed.geometry.coordinates[0];
        }

        console.warn('Unrecognized polygon format:', parsed);
        return null;
    } catch (e) {
        console.error('Error parsing polygon:', e);
        return null;
    }
}

// Calculate bounding box from coordinates
function calculateBounds(coordinates: number[][]): [[number, number], [number, number]] | null {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
        return null;
    }

    const lngs = coordinates.map(coord => coord[0]).filter(v => typeof v === 'number');
    const lats = coordinates.map(coord => coord[1]).filter(v => typeof v === 'number');

    if (lngs.length === 0 || lats.length === 0) {
        return null;
    }

    return [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)]
    ];
}

// Create GeoJSON feature from coordinates
function createPolygonFeature(coordinates: number[][]) {
    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates]
        },
        properties: {}
    };
}

export function ReportMap({
    title = 'Map',
    polygon,
    hazardCodes = [],
    height = 400,
    showControls = false,
    geoserverUrl
}: ReportMapProps) {
    // Parse polygon coordinates
    const polygonCoords = useMemo(() => parsePolygonCoordinates(polygon), [polygon]);

    // Calculate bounds
    const bounds = useMemo(() => {
        if (!polygonCoords) return null;
        return calculateBounds(polygonCoords);
    }, [polygonCoords]);

    // Create GeoJSON feature
    const polygonFeature = useMemo(() => {
        if (!polygonCoords) return null;
        return createPolygonFeature(polygonCoords);
    }, [polygonCoords]);

    // Filter valid hazard layers
    const validHazardLayers = useMemo(() => {
        return hazardCodes
            .filter(code => hazardLayerNameMap[code])
            .map(code => ({
                code,
                layerName: hazardLayerNameMap[code]
            }));
    }, [hazardCodes]);

    // Generate WMS URL for a layer
    const getWmsUrl = useMemo(() => {
        return (layerName: string) => {
            const baseUrl = geoserverUrl || PROD_GEOSERVER_URL;
            return `${baseUrl}/wms?` +
                `SERVICE=WMS&` +
                `VERSION=1.1.0&` +
                `REQUEST=GetMap&` +
                `FORMAT=image/png&` +
                `TRANSPARENT=true&` +
                `LAYERS=${layerName}&` +
                `SRS=EPSG:3857&` +
                `WIDTH=256&` +
                `HEIGHT=256&` +
                `BBOX={bbox-epsg-3857}`;
        };
    }, [geoserverUrl]);

    // Calculate initial view state
    const initialViewState = useMemo(() => {
        if (bounds) {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            const centerLng = (minLng + maxLng) / 2;
            const centerLat = (minLat + maxLat) / 2;

            // Calculate zoom level based on bounds size
            const lngDiff = maxLng - minLng;
            const latDiff = maxLat - minLat;
            const maxDiff = Math.max(lngDiff, latDiff);

            let zoom = 10;
            if (maxDiff > 1) zoom = 7;
            else if (maxDiff > 0.5) zoom = 8;
            else if (maxDiff > 0.2) zoom = 9;
            else if (maxDiff > 0.1) zoom = 10;
            else if (maxDiff > 0.05) zoom = 11;
            else if (maxDiff > 0.02) zoom = 12;
            else zoom = 13;

            return {
                center: [centerLng, centerLat] as [number, number],
                zoom
            };
        }
        return {
            center: [-111.8910, 40.7608] as [number, number],
            zoom: 7
        };
    }, [bounds]);

    // Use the custom hook to initialize the map
    const { mapContainerRef, isMapLoaded } = useReportMap({
        center: initialViewState.center,
        zoom: initialViewState.zoom,
        bounds,
        polygonFeature,
        hazardLayers: validHazardLayers,
        getWmsUrl
    });

    return (
        <div className="border rounded-lg overflow-hidden shadow-sm">
            {title && (
                <div className="bg-muted px-4 py-2 border-b">
                    <h4 className="font-semibold text-sm">{title}</h4>
                </div>
            )}
            <div style={{ height: `${height}px`, position: 'relative' }}>
                {/* Loading overlay */}
                {!isMapLoaded && (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Loading map...</p>
                        </div>
                    </div>
                )}

                <div
                    ref={mapContainerRef}
                    style={{
                        width: '100%',
                        height: '100%',
                        opacity: isMapLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-in'
                    }}
                />
            </div>
            {showControls && (
                <div className="bg-muted px-4 py-2 text-xs text-muted-foreground flex justify-between">
                    <span>Static map view</span>
                    {bounds && (
                        <span>
                            Bounds: [{bounds[0][0].toFixed(4)}, {bounds[0][1].toFixed(4)}] -
                            [{bounds[1][0].toFixed(4)}, {bounds[1][1].toFixed(4)}]
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
