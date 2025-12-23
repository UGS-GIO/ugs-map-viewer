import { useEffect, useMemo, useCallback } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';

interface PopupCoords {
    lat: number;
    lon: number;
}

export type ViewMode = 'map' | 'split' | 'table';

interface MapUrlState {
    center: [number, number];
    zoom: number;
    filters?: Record<string, string>;
    popupCoords: PopupCoords | null;
    setPopupCoords: (coords: PopupCoords | null) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

interface UseMapUrlSyncProps {
    onFiltersChange?: (filters: Record<string, string>) => void;
}

/**
 * Hook that synchronizes map state with URL parameters.
 * Extracts zoom, lat/lon coordinates, filters, and popup coords from URL search params
 * and provides them in a clean interface for map initialization.
 *
 * @param onFiltersChange - Optional callback when filters change in URL
 * @returns Current map state derived from URL parameters
 */
export function useMapUrlSync({ onFiltersChange }: UseMapUrlSyncProps = {}): MapUrlState {
    const search = useSearch({ from: '/_map' });
    const navigate = useNavigate();

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

    // Extract popup coords from URL
    const popupCoords = useMemo(() => {
        if (search.popup_lat !== undefined && search.popup_lon !== undefined) {
            return { lat: search.popup_lat, lon: search.popup_lon };
        }
        return null;
    }, [search.popup_lat, search.popup_lon]);

    // Update popup coords in URL
    const setPopupCoords = useCallback((coords: PopupCoords | null) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                popup_lat: coords?.lat,
                popup_lon: coords?.lon,
            }),
            replace: true,
        });
    }, [navigate]);

    // Extract view mode from URL (default to 'map')
    const viewMode = useMemo((): ViewMode => {
        const mode = (search as { view?: string }).view;
        if (mode === 'split' || mode === 'table') return mode;
        return 'map';
    }, [(search as { view?: string }).view]);

    // Update view mode in URL
    const setViewMode = useCallback((mode: ViewMode) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                view: mode === 'map' ? undefined : mode, // Don't store 'map' since it's default
            }),
            replace: true,
        });
    }, [navigate]);

    return {
        center,
        zoom: search.zoom,
        filters: search.filters,
        popupCoords,
        setPopupCoords,
        viewMode,
        setViewMode,
    };
}