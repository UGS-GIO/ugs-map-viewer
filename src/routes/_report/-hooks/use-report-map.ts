import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';

interface UseReportMapOptions {
    center: [number, number];
    zoom: number;
    bounds?: [[number, number], [number, number]] | null;
    polygonFeature?: GeoJSON.Feature<GeoJSON.Polygon> | null;
    hazardLayers: Array<{ code: string; layerName: string }>;
    getWmsUrl: (layerName: string) => string;
}

export function useReportMap(options: UseReportMapOptions) {
    const { center, zoom, bounds, polygonFeature, hazardLayers, getWmsUrl } = options;
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center,
            zoom,
            attributionControl: false,
            interactive: false
        });

        mapRef.current = map;

        const handleLoad = () => {
            // Add hazard layers
            hazardLayers.forEach(({ code, layerName }) => {
                map.addSource(`hazard-${code}`, {
                    type: 'raster',
                    tiles: [getWmsUrl(layerName)],
                    tileSize: 256
                });

                map.addLayer({
                    id: `hazard-layer-${code}`,
                    type: 'raster',
                    source: `hazard-${code}`,
                    paint: { 'raster-opacity': 0.7 }
                });
            });

            // Add polygon layer
            if (polygonFeature) {
                map.addSource('aoi-polygon', {
                    type: 'geojson',
                    data: polygonFeature
                });

                map.addLayer({
                    id: 'aoi-fill',
                    type: 'fill',
                    source: 'aoi-polygon',
                    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 }
                });

                map.addLayer({
                    id: 'aoi-outline',
                    type: 'line',
                    source: 'aoi-polygon',
                    paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-dasharray': [2, 2] }
                });
            }

            // Fit bounds and show map
            if (bounds) {
                map.fitBounds(bounds as maplibregl.LngLatBoundsLike, { padding: 50, duration: 0 });
            }

            // Wait for tiles to load before showing
            map.once('idle', () => setIsMapLoaded(true));
        };

        map.on('load', handleLoad);

        return () => {
            map.off('load', handleLoad);
            map.remove();
            mapRef.current = null;
        };
    }, [bounds, polygonFeature, hazardLayers, getWmsUrl, center, zoom]);

    return { mapContainerRef, isMapLoaded };
}
