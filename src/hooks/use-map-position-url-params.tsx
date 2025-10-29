import { useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearch } from '@tanstack/react-router';
import Point from "@arcgis/core/geometry/Point.js";

export const useMapPositionUrlParams = (view: __esri.MapView | __esri.SceneView | undefined) => {
    const navigate = useNavigate();
    const search = useSearch({ from: "/_map" });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const updateUrlFromView = useCallback(() => {
        if (!view) return;

        try {
            const { latitude, longitude } = view.center;
            const zoom = view.zoom;

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

            // Only update if values are valid numbers
            if (!isNaN(formattedLongitude) && !isNaN(formattedLatitude) && !isNaN(zoom)) {
                navigate({
                    to: ".",
                    search: (prev) => ({
                        ...prev,
                        zoom: zoom,
                        lat: formattedLatitude,
                        lon: formattedLongitude,
                    }),
                    replace: true,
                });
            }
        } catch (error) {
            // Silently fail if view is in an invalid state during transitions
            console.debug('Map position update skipped during view transition');
        }
    }, [view, navigate]);

    useEffect(() => {
        if (!view) return;

        const handleUpdate = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            // Increased debounce to 500ms to ensure view is fully settled after basemap changes
            timeoutRef.current = setTimeout(updateUrlFromView, 500);
        };

        const stationaryWatcher = view.watch("stationary", handleUpdate);

        return () => {
            stationaryWatcher.remove();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [view, updateUrlFromView]);

    // Initialize map view based on URL parameters
    useEffect(() => {
        if (!view || !search) return;

        const zoom = typeof search.zoom === 'number' ? search.zoom : parseFloat(search.zoom || '');
        const lat = typeof search.lat === 'number' ? search.lat : parseFloat(search.lat || '');
        const lon = typeof search.lon === 'number' ? search.lon : parseFloat(search.lon || '');

        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lon)) {
            const isOutOfSync = view.zoom !== zoom ||
                parseFloat(view.center?.latitude?.toFixed(3) || '') !== lat ||
                parseFloat(view.center?.longitude?.toFixed(3) || '') !== lon;

            if (isOutOfSync) {
                view.goTo({
                    center: new Point({ latitude: lat, longitude: lon }),
                    zoom: zoom
                });
            }
        }
    }, [view, search.zoom, search.lat, search.lon]);
};