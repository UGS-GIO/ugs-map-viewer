import { useEffect, useRef } from 'react';
import { findAndApplyMapLibreWMSFilter } from '@/lib/sidebar/filter/util';
import maplibregl from 'maplibre-gl';

interface FilterMapping {
    [filterKey: string]: {
        layerTitle: string;
        autoSelectLayer?: boolean;
    };
}

interface UseDomainFiltersProps {
    map?: maplibregl.Map | undefined;
    filters: Record<string, string> | undefined;
    selectedLayers: string[];
    updateLayerSelection: (title: string, selected: boolean) => void;
    filterMapping: FilterMapping;
}

/**
 * Hook that handles domain-specific filter application for WMS layers.
 * Applies WMS filters from URL parameters to the map and updates layer selection state.
 * This is separated from generic URL sync to keep domain logic isolated.
 *
 * @param map - MapLibre map instance
 * @param filters - Filter values from URL parameters
 * @param selectedLayers - Currently selected layer titles
 * @param updateLayerSelection - Function to update layer selection state
 * @param filterMapping - Mapping of filter keys to layer configurations
 */
export function useDomainFilters({
    map,
    filters,
    selectedLayers,
    updateLayerSelection,
    filterMapping
}: UseDomainFiltersProps) {
    const selectedLayersRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        selectedLayersRef.current = new Set(selectedLayers);
    }, [selectedLayers]);

    useEffect(() => {
        console.log('[useDomainFilters] Effect triggered:', {
            hasMap: !!map,
            filters,
            selectedLayers,
            filterMapping: Object.keys(filterMapping)
        });

        if (!map) return;

        const filtersFromUrl = filters ?? {};

        // Apply each configured filter
        Object.entries(filterMapping).forEach(([filterKey, config]) => {
            const filterValue = filtersFromUrl[filterKey] || null;
            const { layerTitle, autoSelectLayer = true } = config;

            console.log('[useDomainFilters] Processing filter:', {
                filterKey,
                layerTitle,
                filterValue,
                autoSelectLayer,
                isLayerAlreadySelected: selectedLayersRef.current.has(layerTitle),
                willAutoSelect: !!(filterValue && autoSelectLayer && !selectedLayersRef.current.has(layerTitle))
            });

            findAndApplyMapLibreWMSFilter(map, layerTitle, filterValue);

            // Only auto-select the layer if it has a filter AND is not already selected
            if (filterValue && autoSelectLayer && !selectedLayersRef.current.has(layerTitle)) {
                console.log('[useDomainFilters] Auto-selecting layer (not already selected):', layerTitle);
                updateLayerSelection(layerTitle, true);
            }
        });
    }, [map, filters, updateLayerSelection, filterMapping]);
}