import { MapControlConfig } from '@/hooks/use-map-controls';

/**
 * Default MapLibre GL controls configuration for all map pages
 * Provides navigation (zoom + compass), home (reset to default bounds), geolocation, and export
 */
export const DEFAULT_MAP_CONTROLS: MapControlConfig[] = [
    { type: 'navigation', position: 'top-left' },
    { type: 'home', position: 'top-left' },
    { type: 'geolocate', position: 'top-left' },
    {
        type: 'export',
        position: 'top-right',
        options: {
            PageSize: 'A4',
            PageOrientation: 'landscape',
            Format: 'png',
            DPI: 300,
            Crosshair: true,
            PrintableArea: true,
            Local: 'en',
            AllowedSizes: ['A3', 'A4', 'LETTER'],
            Filename: 'ugs-map'
        }
    },
];
