import { useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { linkHasCamera } from '@/lib/map/app-history';
import type { Polygon } from 'geojson';
import { formatArea, formatBbox, parseArea, parseBbox, round6 } from '@/lib/map/url-geometry';
import type { BoundsBox } from '@/components/maps/types';
import type { MapSearch } from '@/routes/_map';

interface PopupCoords {
    lat: number;
    lon: number;
}

export type ViewMode = 'map' | 'split' | 'table';

export interface SelectedFeatureRef {
    layer: string;
    id: string;
}

interface MapUrlState {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
    setMapPosition: (lat: number, lon: number, zoom: number, pitch?: number, bearing?: number) => void;
    filters?: Record<string, string>;
    popupCoords: PopupCoords | null;
    setPopupCoords: (coords: PopupCoords | null) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    basemap: string | undefined;
    setBasemap: (id: string) => void;
    clickBufferBounds: BoundsBox | null;
    setClickBufferBounds: (bounds: BoundsBox | null) => void;
    /** What the map fits on load: a link's selection, only when the link carries no camera of its own */
    initialBounds: BoundsBox | null;
    setFeatureBbox: (bbox: BoundsBox | null) => void;
    boxSelectBounds: BoundsBox | null;
    setBoxSelectBounds: (bounds: BoundsBox | null) => void;
    spatialFilter: Polygon | null;
    setSpatialFilter: (polygon: Polygon | null) => void;
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

    // Update map position (lat, lon, zoom) in URL - debounced to avoid
    // cascading re-renders during continuous zoom/pan (Chrome fires many
    // discrete wheel events per scroll gesture, each triggering moveend)
    const positionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (positionTimeoutRef.current) clearTimeout(positionTimeoutRef.current);
        };
    }, []);

    const setMapPosition = useCallback((lat: number, lon: number, zoom: number, pitch = 0, bearing = 0) => {
        if (positionTimeoutRef.current) clearTimeout(positionTimeoutRef.current);
        positionTimeoutRef.current = setTimeout(() => {
            navigate({
                to: ".",
                search: (prev) => ({
                    ...prev,
                    lat: round6(lat),
                    lon: round6(lon),
                    zoom: Math.round(zoom * 100) / 100,
                    // Flat, north-up is the default, so keep it out of the URL
                    pitch: Math.round(pitch) || undefined,
                    bearing: Math.round(bearing) || undefined,
                }),
                replace: true,
            });
        }, 150);
    }, [navigate]);

    const setParams = useCallback((patch: Partial<MapSearch>) => {
        navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });
    }, [navigate]);

    const clickBufferBounds = useMemo(() => parseBbox(search.click_bbox), [search.click_bbox]);
    const setClickBufferBounds = useCallback((bounds: BoundsBox | null) => setParams({ click_bbox: formatBbox(bounds) }), [setParams]);

    const featureBbox = useMemo(() => parseBbox(search.feature_bbox), [search.feature_bbox]);
    const initialBounds = linkHasCamera ? null : featureBbox ?? clickBufferBounds;
    const setFeatureBbox = useCallback((bbox: BoundsBox | null) => setParams({ feature_bbox: formatBbox(bbox) }), [setParams]);

    // Box select and drawn-area results, so Back/Forward and shared links bring them back
    const boxSelectBounds = useMemo(() => parseBbox(search.box_bbox), [search.box_bbox]);
    const setBoxSelectBounds = useCallback((bounds: BoundsBox | null) => setParams({ box_bbox: formatBbox(bounds) }), [setParams]);

    const spatialFilter = useMemo(() => parseArea(search.area), [search.area]);
    const setSpatialFilter = useCallback((polygon: Polygon | null) => setParams({ area: formatArea(polygon) }), [setParams]);

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
        pitch: search.pitch ?? 0,
        bearing: search.bearing ?? 0,
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
        initialBounds,
        setFeatureBbox,
        boxSelectBounds,
        setBoxSelectBounds,
        spatialFilter,
        setSpatialFilter,
        selectedFeatureRefs,
        setSelectedFeatureRefs,
    };
}