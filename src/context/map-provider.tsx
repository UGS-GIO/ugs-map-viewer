import { MapContext, MapContextProps } from "@/context/map-context";
import { ArcGISMapProvider } from "@/context/arcgis-map-provider";
import { MapLibreMapProvider } from "@/context/maplibre-map-provider";

/**
 * Conditional MapProvider wrapper
 *
 * Routes to either ArcGISMapProvider or MapLibreMapProvider based on VITE_MAP_IMPL environment variable.
 *
 * Both providers:
 * - Expose the same MapContext interface
 * - Implement loadMap, isSketching, setIsSketching
 * - Are completely independent and can be swapped without affecting consumers
 *
 * This design enables:
 * 1. Parallel development of MapLibre implementation
 * 2. Feature flag testing without code changes
 * 3. Easy deletion of ArcGIS code after migration
 *
 * Feature flag: VITE_MAP_IMPL
 * - 'arcgis': Use ArcGIS Maps SDK (current default)
 * - 'maplibre': Use MapLibre GL JS (new implementation)
 */
export function MapProvider({ children }: { children: React.ReactNode }) {
    const mapImpl = import.meta.env.VITE_MAP_IMPL || 'arcgis';

    if (mapImpl === 'maplibre') {
        return (
            <MapLibreMapProvider>
                {children}
            </MapLibreMapProvider>
        );
    }

    // Default to ArcGIS
    return (
        <ArcGISMapProvider>
            {children}
        </ArcGISMapProvider>
    );
}

// Re-export for consumers
export { MapContext, type MapContextProps };
