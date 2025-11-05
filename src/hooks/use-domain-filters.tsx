import { useEffect } from 'react';
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
 * @param updateLayerSelection - Function to update layer selection state
 * @param filterMapping - Mapping of filter keys to layer configurations
 */
export function useDomainFilters({
    map,
    filters,
    updateLayerSelection,
    filterMapping
}: UseDomainFiltersProps) {
    useEffect(() => {
        if (!map) return;

        const filtersFromUrl = filters ?? {};

        // Apply each configured filter
        Object.entries(filterMapping).forEach(([filterKey, config]) => {
            const filterValue = filtersFromUrl[filterKey] || null;
            const { layerTitle, autoSelectLayer = true } = config;

            findAndApplyMapLibreWMSFilter(map, layerTitle, filterValue);

            if (filterValue && autoSelectLayer) {
                updateLayerSelection(layerTitle, true);
            }
        });
    }, [map, filters, updateLayerSelection, filterMapping]);
}