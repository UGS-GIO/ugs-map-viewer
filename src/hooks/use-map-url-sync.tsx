import { useEffect, useMemo, useCallback } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';

interface PopupCoords {
    lat: number;
    lon: number;
}

export type ViewMode = 'map' | 'split' | 'table';

export interface ClickBufferBounds {
    sw: [number, number];
    ne: [number, number];
}

export interface SelectedFeatureRef {
    layer: string;
    id: string;
}

export interface FeatureBbox {
    sw: [number, number];
    ne: [number, number];
}

interface MapUrlState {
    center: [number, number];
    zoom: number;
    setMapPosition: (lat: number, lon: number, zoom: number) => void;
    filters?: Record<string, string>;
    popupCoords: PopupCoords | null;
    setPopupCoords: (coords: PopupCoords | null) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    basemap: string | undefined;
    setBasemap: (id: string) => void;
    clickBufferBounds: ClickBufferBounds | null;
    setClickBufferBounds: (bounds: ClickBufferBounds | null) => void;
    featureBbox: FeatureBbox | null;
    setFeatureBbox: (bbox: FeatureBbox | null) => void;
    selectedFeatureRefs: SelectedFeatureRef[];
    setSelectedFeatureRefs: (refs: SelectedFeatureRef[]) => void;
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
// Round to 6 decimal places (~0.1m precision) for cleaner URLs
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

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
    // Note: Zod schema validates this, so we can trust the type
    const viewMode: ViewMode = search.view ?? 'map';

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

    // Update basemap in URL
    const setBasemap = useCallback((id: string) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                basemap: id,
            }),
            replace: true,
        });
    }, [navigate]);

    // Update map position (lat, lon, zoom) in URL
    const setMapPosition = useCallback((lat: number, lon: number, zoom: number) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                lat: round6(lat),
                lon: round6(lon),
                zoom: Math.round(zoom * 100) / 100, // 2 decimal places for zoom
            }),
            replace: true,
        });
    }, [navigate]);

    // Parse click buffer bounds from URL (format: sw_lng,sw_lat,ne_lng,ne_lat)
    const clickBufferBounds = useMemo((): ClickBufferBounds | null => {
        if (!search.click_bbox) return null;
        const parts = search.click_bbox.split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return null;
        return {
            sw: [parts[0], parts[1]],
            ne: [parts[2], parts[3]],
        };
    }, [search.click_bbox]);

    // Update click buffer bounds in URL
    const setClickBufferBounds = useCallback((bounds: ClickBufferBounds | null) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                click_bbox: bounds
                    ? `${round6(bounds.sw[0])},${round6(bounds.sw[1])},${round6(bounds.ne[0])},${round6(bounds.ne[1])}`
                    : undefined,
            }),
            replace: true,
        });
    }, [navigate]);

    // Parse feature bbox from URL (format: sw_lng,sw_lat,ne_lng,ne_lat)
    const featureBbox = useMemo((): FeatureBbox | null => {
        if (!search.feature_bbox) return null;
        const parts = search.feature_bbox.split(',').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return null;
        return {
            sw: [parts[0], parts[1]],
            ne: [parts[2], parts[3]],
        };
    }, [search.feature_bbox]);

    // Update feature bbox in URL
    const setFeatureBbox = useCallback((bbox: FeatureBbox | null) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                feature_bbox: bbox
                    ? `${round6(bbox.sw[0])},${round6(bbox.sw[1])},${round6(bbox.ne[0])},${round6(bbox.ne[1])}`
                    : undefined,
            }),
            replace: true,
        });
    }, [navigate]);

    // Parse selected features from URL (format: layer:id,layer:id,...)
    const selectedFeatureRefs = useMemo((): SelectedFeatureRef[] => {
        if (!search.features) return [];
        return search.features.split(',').map(pair => {
            const colonIndex = pair.indexOf(':');
            if (colonIndex === -1) return null;
            return {
                layer: pair.slice(0, colonIndex),
                id: pair.slice(colonIndex + 1),
            };
        }).filter((ref): ref is SelectedFeatureRef => ref !== null);
    }, [search.features]);

    // Update selected features in URL
    const setSelectedFeatureRefs = useCallback((refs: SelectedFeatureRef[]) => {
        navigate({
            to: ".",
            search: (prev) => ({
                ...prev,
                features: refs.length > 0
                    ? refs.map(r => `${r.layer}:${r.id}`).join(',')
                    : undefined,
            }),
            replace: true,
        });
    }, [navigate]);

    return {
        center,
        zoom: search.zoom,
        setMapPosition,
        filters: search.filters,
        popupCoords,
        setPopupCoords,
        viewMode,
        setViewMode,
        basemap: search.basemap,
        setBasemap,
        clickBufferBounds,
        setClickBufferBounds,
        featureBbox,
        setFeatureBbox,
        selectedFeatureRefs,
        setSelectedFeatureRefs,
    };
}