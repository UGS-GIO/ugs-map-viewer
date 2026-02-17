import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { MapLibreMap } from "@/lib/types/map-types";

export const useMapPositionUrlParams = (map: MapLibreMap | null) => {
    const navigate = useNavigate();
    const search = useSearch({ from: "/_map" });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const updateUrlFromMap = useCallback(() => {
        if (!map) return;

        try {
            const center = map.getCenter();
            const zoom = map.getZoom();

            const latitude = center.lat;
            const longitude = center.lng;

            // Validate all values before updating URL
            if (
                zoom === undefined ||
                zoom === null ||
                isNaN(zoom) ||
                latitude === undefined ||
                latitude === null ||
                isNaN(latitude) ||
                longitude === undefined ||
                longitude === null ||
                isNaN(longitude)
            ) {
                return;
            }

            const formattedLongitude = parseFloat(longitude.toFixed(3));
            const formattedLatitude = parseFloat(latitude.toFixed(3));
            const formattedZoom = parseFloat(zoom.toFixed(2));

            // Only update if values are valid numbers
            if (!isNaN(formattedLongitude) && !isNaN(formattedLatitude) && !isNaN(formattedZoom)) {
                navigate({
                    to: ".",
                    search: (prev) => ({
                        ...prev,
                        zoom: formattedZoom,
                        lat: formattedLatitude,
                        lon: formattedLongitude,
                    }),
                    replace: true,
                });
            }
        } catch (error) {
            // Silently fail if map is in an invalid state during transitions
            console.debug('Map position update skipped during transition');
        }
    }, [map, navigate]);

    useEffect(() => {
        if (!map) return;

        const handleUpdate = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            // Debounce to 500ms to ensure map is fully settled
            timeoutRef.current = setTimeout(updateUrlFromMap, 500);
        };

        // Listen to map move events
        map.on('moveend', handleUpdate);

        return () => {
            map.off('moveend', handleUpdate);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [map, updateUrlFromMap]);

    // Initialize map position based on URL parameters
    useEffect(() => {
        if (!map || !search) return;

        const zoom = typeof search.zoom === 'number' ? search.zoom : parseFloat(search.zoom || '');
        const lat = typeof search.lat === 'number' ? search.lat : parseFloat(search.lat || '');
        const lon = typeof search.lon === 'number' ? search.lon : parseFloat(search.lon || '');

        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lon)) {
            const currentCenter = map.getCenter();
            const currentZoom = map.getZoom();

            const isOutOfSync = currentZoom !== zoom ||
                parseFloat(currentCenter.lat.toFixed(3)) !== lat ||
                parseFloat(currentCenter.lng.toFixed(3)) !== lon;

            if (isOutOfSync) {
                map.setCenter([lon, lat]);
                map.setZoom(zoom);
            }
        }
    }, [map, search.zoom, search.lat, search.lon]);
};
