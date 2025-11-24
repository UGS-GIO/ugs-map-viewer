import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { convertPolygonToWGS84, calculateBounds, calculateZoomFromBounds } from '@/lib/map/conversion-utils';
import { queryKeys } from '@/lib/query-keys';

interface UseMapLibreScreenshotProps {
    polygon?: string | null; // Polygon JSON string with rings (optional - screenshot only generates when provided)
    width?: string; // CSS width value (e.g., "50vw", "800px")
    height?: string; // CSS height value (e.g., "50vh", "600px")
}

/**
 * Generate MapLibre screenshot of a polygon area
 * Returns a data URL of the screenshot
 */
async function generateMapLibreScreenshot(
    polygon: string,
    width: string,
    height: string
): Promise<string> {
    // Convert polygon to WGS84
    const coordinates = convertPolygonToWGS84(polygon);
    if (!coordinates) {
        throw new Error('Failed to convert polygon coordinates');
    }

    // Calculate bounds and zoom
    const bounds = calculateBounds(coordinates);
    if (!bounds) {
        throw new Error('Failed to calculate bounds');
    }

    const [[minLng, minLat], [maxLng, maxLat]] = bounds;
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const zoom = calculateZoomFromBounds(bounds);

    // Create temporary container
    const container = document.createElement('div');
    container.style.width = width;
    container.style.height = height;
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    let mapRef: MapLibreMap | null = null;

    try {
        // Initialize MapLibre map
        const map = new maplibregl.Map({
            container,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [centerLng, centerLat],
            zoom,
            // @ts-expect-error - preserveDrawingBuffer is valid
            preserveDrawingBuffer: true,
            attributionControl: false,
            interactive: false,
            pitch: 0,
            bearing: 0
        });

        mapRef = map;

        // Wait for map to load and capture screenshot
        const dataUrl = await new Promise<string>((resolve, reject) => {
            let isResolved = false;
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    reject(new Error('Map screenshot timeout - took too long to load'));
                }
            }, 15000); // 15 second timeout

            map.on('load', () => {
                if (isResolved) return;

                try {
                    // Add polygon source and layer
                    map.addSource('aoi-polygon', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: {
                                type: 'Polygon',
                                coordinates: [coordinates]
                            },
                            properties: {}
                        }
                    });

                    map.addLayer({
                        id: 'aoi-fill',
                        type: 'fill',
                        source: 'aoi-polygon',
                        paint: {
                            'fill-color': '#8a2be2',
                            'fill-opacity': 0.5
                        }
                    });

                    map.addLayer({
                        id: 'aoi-outline',
                        type: 'line',
                        source: 'aoi-polygon',
                        paint: {
                            'line-color': 'white',
                            'line-width': 2
                        }
                    });

                    // Fit to bounds
                    map.fitBounds(bounds, { padding: 50, duration: 0 });

                    // Wait for tiles to load, then capture
                    const attemptCapture = () => {
                        if (map.loaded() && map.areTilesLoaded()) {
                            map.once('render', () => {
                                try {
                                    const canvas = map.getCanvas();
                                    const dataUrl = canvas.toDataURL('image/png', 1.0);

                                    if (dataUrl && dataUrl.length > 100) {
                                        if (!isResolved) {
                                            isResolved = true;
                                            clearTimeout(timeout);
                                            resolve(dataUrl);
                                        }
                                    } else {
                                        throw new Error('Screenshot data is empty');
                                    }
                                } catch (e) {
                                    if (!isResolved) {
                                        isResolved = true;
                                        clearTimeout(timeout);
                                        reject(e);
                                    }
                                }
                            });
                            map.triggerRepaint();
                        } else {
                            setTimeout(attemptCapture, 500);
                        }
                    };

                    // Start attempting to capture after a delay
                    setTimeout(attemptCapture, 2000);
                } catch (e) {
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        reject(e);
                    }
                }
            });

            map.on('error', (e: any) => {
                if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeout);
                    reject(new Error(`Map error: ${e.error?.message || 'Unknown'}`));
                }
            });
        });

        return dataUrl;
    } finally {
        // Cleanup after a short delay to ensure screenshot was captured
        setTimeout(() => {
            if (mapRef) {
                try {
                    mapRef.remove();
                } catch (e) {
                    console.error('Error removing map:', e);
                }
            }

            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 100);
    }
}

/**
 * Hook to generate a MapLibre screenshot of a polygon area using TanStack Query
 * Only queries when polygon is provided
 */
export function useMapLibreScreenshot({ polygon, width = '50vw', height = '50vh' }: UseMapLibreScreenshotProps) {
    const { data: screenshot, isPending, error } = useQuery({
        queryKey: queryKeys.map.screenshot(polygon || '', width, height),
        queryFn: async () => {
            if (!polygon) {
                throw new Error('Polygon is required');
            }
            return generateMapLibreScreenshot(polygon, width, height);
        },
        enabled: !!polygon,
        staleTime: Infinity, // Screenshots don't become stale
        gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    });

    return {
        screenshot: screenshot || null,
        isLoading: isPending,
        error: error instanceof Error ? error.message : null
    };
}
