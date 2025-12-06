import { useEffect, useMemo } from 'react';
import { useSearch } from '@tanstack/react-router';

interface MapUrlState {
    center: [number, number];
    zoom: number;
    filters?: Record<string, string>;
}

interface UseMapUrlSyncProps {
    onFiltersChange?: (filters: Record<string, string>) => void;
}

/**
 * Hook that synchronizes map state with URL parameters.
 * Extracts zoom, lat/lon coordinates, and filters from URL search params
 * and provides them in a clean interface for map initialization.
 *
 * @param onFiltersChange - Optional callback when filters change in URL
 * @returns Current map state derived from URL parameters
 */
export function useMapUrlSync({ onFiltersChange }: UseMapUrlSyncProps = {}): MapUrlState {
    const search = useSearch({ from: '/_map' });

    useEffect(() => {
        if (onFiltersChange && search.filters) {
            onFiltersChange(search.filters);
        }
    }, [search.filters, onFiltersChange]);

    // Memoize center array to prevent unnecessary re-renders
    const center = useMemo(
        () => [search.lon, search.lat] as [number, number],
        [search.lon, search.lat]
    );

    return {
        center,
        zoom: search.zoom,
        filters: search.filters
    };
}