import { useState, useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

interface UseMapLoadingProps {
    map?: maplibregl.Map;
    debounceMs?: number;
}

/**
 * Hook to detect MapLibre map loading state
 * Returns true while the map is loading tiles and rendering
 */
export function useMapLoading({
    map,
    debounceMs = 200
}: UseMapLoadingProps): boolean {
    const [isLoading, setIsLoading] = useState(true);
    const hasInitiallyLoadedRef = useRef(false);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Cleanup previous effects
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (!map) {
            setIsLoading(false);
            return;
        }

        // If we've already completed initial load, don't show loading
        if (hasInitiallyLoadedRef.current) {
            setIsLoading(false);
            return;
        }

        const updateLoadingStatus = () => {
            // If we've already completed initial load, ignore further updates
            if (hasInitiallyLoadedRef.current) {
                return;
            }

            // MapLibre doesn't have direct loading events like ArcGIS
            // Check if style is loaded and all sources are ready
            const isCurrentlyLoading = !map.isStyleLoaded();

            // Clear any pending timeout
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
                debounceTimeoutRef.current = null;
            }

            if (isCurrentlyLoading) {
                // Map is loading - set immediately
                setIsLoading(true);
            } else {
                // Map appears to be done loading - debounce before marking as complete
                debounceTimeoutRef.current = setTimeout(() => {
                    if (!hasInitiallyLoadedRef.current) {
                        setIsLoading(false);
                        hasInitiallyLoadedRef.current = true;
                    }
                }, debounceMs);
            }
        };

        // Listen to MapLibre loading events
        map.on('load', updateLoadingStatus);
        map.on('sourcedata', updateLoadingStatus);
        map.on('styledata', updateLoadingStatus);

        // Check initial state
        updateLoadingStatus();

        // Cleanup function
        return () => {
            map.off('load', updateLoadingStatus);
            map.off('sourcedata', updateLoadingStatus);
            map.off('styledata', updateLoadingStatus);
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [map, debounceMs]);

    return isLoading;
}
