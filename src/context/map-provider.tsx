import { MapContext, MapContextProps } from "@/context/map-context";
import { MapLibreMapProvider } from "@/context/maplibre-map-provider";

/**
 * MapLibre GL JS map provider
 * Provides map context for all map-related functionality across the application
 */
export function MapProvider({ children }: { children: React.ReactNode }) {
    return (
        <MapLibreMapProvider>
            {children}
        </MapLibreMapProvider>
    );
}

// Re-export for consumers
export { MapContext, type MapContextProps };
