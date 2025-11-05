import { MapControlConfig } from '@/hooks/use-map-controls';

/**
 * Default MapLibre GL controls configuration for all map pages
 * Provides navigation (zoom + compass), home (reset to default bounds), and geolocation
 */
export const DEFAULT_MAP_CONTROLS: MapControlConfig[] = [
    { type: 'navigation', position: 'top-left' },
    { type: 'home', position: 'top-left' },
    { type: 'geolocate', position: 'top-left' },
];
