import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { hazardLayerNameMap as importedHazardLayerNameMap } from '@/routes/_report/-data/hazard-unit-map';
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { convertCoordinate, calculateBounds } from '@/lib/map/conversion-utils';

const hazardLayerNameMap: Record<string, string> = importedHazardLayerNameMap as Record<string, string>;

interface ReportScreenshotProps {
    title?: string;
    polygon?: string;
    hazardCodes?: string[];
    height?: number;
    geoserverUrl?: string;
    tooltip?: React.ReactNode;
}

// Parse polygon coordinates
function parsePolygonCoordinates(polygon: string | undefined): number[][] | null {
    if (!polygon) return null;

    try {
        const parsed = JSON.parse(polygon);

        if (parsed.rings && Array.isArray(parsed.rings[0])) {
            const coords = parsed.rings[0];
            const sourceCRS = parsed.crs || 'EPSG:4326'; // Default to WGS84

            // Convert to WGS84 if not already
            if (sourceCRS !== 'EPSG:4326') {
                return coords.map(([x, y]: number[]) => {
                    const converted = convertCoordinate([x, y], sourceCRS, 'EPSG:4326');
                    return converted;
                });
            }

            return coords;
        }

        if (Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') {
            return parsed;
        }

        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
            return parsed.coordinates[0];
        }

        if (Array.isArray(parsed[0]?.[0]) && typeof parsed[0][0][0] === 'number') {
            return parsed[0];
        }

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

// Helper to calculate distance for scale (simplified)
function calculateScale(zoom: number, lat: number, canvasWidth: number): { distance: number; unit: string } {
    // Approximate meters per pixel at current latitude and zoom level
    // This is a simplified calculation and can be improved for accuracy
    const metersPerPixel = (40075016.686 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8); // 256px tile

    // Let's aim for a scale bar that is roughly 1/5th of the canvas width
    const targetPixels = canvasWidth / 5;
    let distanceInMeters = targetPixels * metersPerPixel;

    let unit = 'm';
    if (distanceInMeters > 1000) {
        distanceInMeters /= 1000;
        unit = 'km';
    }

    // Adjust to a "nice" rounded number
    const niceNumbers = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    let bestDistance = niceNumbers[0];
    for (let i = 0; i < niceNumbers.length; i++) {
        if (distanceInMeters / niceNumbers[i] >= 0.7) { // Choose the largest nice number that is less than or equal to current distance, or just slightly larger
            bestDistance = niceNumbers[i];
        } else {
            break;
        }
    }

    return { distance: bestDistance, unit };
}


export function ReportScreenshot({
    title = 'Map',
    polygon,
    hazardCodes = [],
    height = 400,
    geoserverUrl,
    tooltip
}: ReportScreenshotProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(true);
    const [mapState, setMapState] = useState<{ center: [number, number], zoom: number, canvasWidth: number } | null>(null);

    const polygonCoords = useMemo(() => parsePolygonCoordinates(polygon), [polygon]);
    const bounds = useMemo(() => {
        if (!polygonCoords) return null;
        return calculateBounds(polygonCoords);
    }, [polygonCoords]);

    const polygonFeature = useMemo(() => {
        if (!polygonCoords) return null;
        return createPolygonFeature(polygonCoords);
    }, [polygonCoords]);

    const validHazardLayers = useMemo(() => {
        return hazardCodes
            .filter(code => hazardLayerNameMap[code])
            .map(code => ({
                code,
                layerName: hazardLayerNameMap[code]
            }));
    }, [hazardCodes]);

    const initialViewState = useMemo(() => {
        if (bounds) {
            const [[minLng, minLat], [maxLng, maxLat]] = bounds;
            const centerLng = (minLng + maxLng) / 2;
            const centerLat = (minLat + maxLat) / 2;

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

    const captureScreenshot = useCallback((map: MapLibreMap) => {
        try {
            const canvas = map.getCanvas();
            const dataUrl = canvas.toDataURL('image/png', 1.0);

            if (dataUrl.length < 100) {
                console.error('Screenshot appears to be empty');
                setIsCapturing(false);
                return;
            }

            setScreenshot(dataUrl);
            setIsCapturing(false);

            // Update map state for scale calculation after screenshot
            setMapState({
                center: map.getCenter().toArray() as [number, number],
                zoom: map.getZoom(),
                canvasWidth: canvas.width
            });

        } catch (error) {
            console.error('Error capturing screenshot:', error);
            setIsCapturing(false);
        }
    }, []);


    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        // Initialize map with preserveDrawingBuffer
        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: initialViewState.center,
            zoom: initialViewState.zoom,
            // @ts-expect-error - preserveDrawingBuffer is a valid option
            preserveDrawingBuffer: true,
            attributionControl: false,
            interactive: false
        });

        mapRef.current = map;

        map.on('load', () => {
            if (bounds) {
                map.fitBounds(bounds, { padding: 50, duration: 0 });
            }

            validHazardLayers.forEach(({ code, layerName }) => {
                const baseUrl = geoserverUrl || PROD_GEOSERVER_URL;
                const wmsUrl = `${baseUrl}/wms?` +
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

                map.addSource(`hazard-${code}`, {
                    type: 'raster',
                    tiles: [wmsUrl],
                    tileSize: 256
                });

                map.addLayer({
                    id: `hazard-layer-${code}`,
                    type: 'raster',
                    source: `hazard-${code}`,
                    paint: {
                        'raster-opacity': 0.7
                    }
                });
            });

            if (polygonFeature) {
                map.addSource('aoi-polygon', {
                    type: 'geojson',
                    data: polygonFeature
                });

                map.addLayer({
                    id: 'aoi-fill',
                    type: 'fill',
                    source: 'aoi-polygon',
                    paint: {
                        'fill-color': '#3b82f6',
                        'fill-opacity': 0.1
                    }
                });

                map.addLayer({
                    id: 'aoi-outline',
                    type: 'line',
                    source: 'aoi-polygon',
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 2.5,
                        'line-dasharray': [2, 2]
                    }
                });
            }

            const attemptCapture = () => {
                if (map.loaded() && map.areTilesLoaded()) {
                    map.once('render', () => {
                        captureScreenshot(map);
                    });
                    map.triggerRepaint();
                } else {
                    setTimeout(attemptCapture, 500);
                }
            };

            setTimeout(attemptCapture, 2000);
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [bounds, validHazardLayers, polygonFeature, initialViewState, geoserverUrl, captureScreenshot]);


    const scaleInfo = useMemo(() => {
        if (mapState) {
            const { center, zoom, canvasWidth } = mapState;
            const { distance, unit } = calculateScale(zoom, center[1], canvasWidth);

            // CALCULATE PIXEL LENGTH FOR THE BAR
            const metersPerPixel = (40075016.686 * Math.cos(center[1] * Math.PI / 180)) / Math.pow(2, zoom + 8);
            const distanceInMeters = unit === 'km' ? distance * 1000 : distance;
            const pixelWidth = (distanceInMeters / metersPerPixel);

            return {
                text: `${distance} ${unit}`,
                pixelWidth: Math.round(pixelWidth)
            };
        }
        return null;
    }, [mapState]);

    // If screenshot is ready, just show the image
    // If screenshot is ready, just show the image
    if (screenshot) {
        return (
            <div className="overflow-hidden shadow-sm print-map-container">
                {/* Title Header */}
                {title && (
                    <div className="bg-muted px-4 py-2 border-t border-x rounded-t-lg flex justify-between items-center">
                        <span className="font-semibold text-sm">{title}</span>
                        {tooltip && <div>{tooltip}</div>}
                    </div>
                )}

                {/* MAP IMAGE AREA */}
                <div className="relative bg-secondary border-x" style={{ height: `${height}px` }}>
                    <img
                        src={screenshot}
                        alt={title}
                        className="print-map-image w-full h-full object-contain block"
                    />
                </div>

                {/* SCALE BAR */}
                {scaleInfo && (
                    <div className="px-4 py-2 border-x border-b rounded-b-lg flex justify-start bg-muted">
                        <div className="text-xs flex items-center gap-2">
                            <span className="text-foreground">Scale:</span>
                            {/* Visual Scale Bar */}
                            <div
                                style={{ width: `${scaleInfo.pixelWidth}px`, minWidth: '30px' }}
                                className="h-1 bg-muted-foreground border-t border-b border-muted"
                            />
                            <span className="text-foreground">{scaleInfo.text}</span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Otherwise, render the map (hidden) to capture it
    return (
        <div className="border rounded-lg overflow-hidden shadow-sm">
            <div className="relative" style={{ height: `${height}px` }}>
                {/* Loading overlay */}
                {isCapturing && (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-muted-foreground">Capturing map...</p>
                        </div>
                    </div>
                )}

                <div ref={mapContainer} className="w-full h-full" />
            </div>
        </div>
    );
}