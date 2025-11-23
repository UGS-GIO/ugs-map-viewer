import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { HomeControl } from '@/lib/map/controls/home-control';
import { MultiSelectControl } from '@/lib/map/controls/multi-select-control';
import '@/lib/map/controls/export-control-overrides.css';

type ControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface MapControlConfig {
    type: 'home' | 'navigation' | 'geolocate' | 'scale' | 'fullscreen' | 'multi-select' | 'export';
    position?: ControlPosition;
    options?: Record<string, any>;
}

/**
 * Hook to add MapLibre GL JS controls to the map
 * Manages lifecycle of map controls (add on mount, remove on unmount)
 */
export function useMapControls(map: maplibregl.Map | undefined, controls: readonly MapControlConfig[]) {
    const controlRefsRef = useRef<maplibregl.IControl[]>([]);

    useEffect(() => {
        if (!map) {
            return;
        }

        // Remove previously added controls before adding new ones
        controlRefsRef.current.forEach(control => {
            map.removeControl(control);
        });
        controlRefsRef.current = [];

        // Add controls from configuration
        const addControls = async () => {
            for (const { type, position = 'top-left', options = {} } of controls) {
                let control: maplibregl.IControl | null = null;

                switch (type) {
                    case 'navigation':
                        control = new maplibregl.NavigationControl(options);
                        break;
                    case 'fullscreen':
                        control = new maplibregl.FullscreenControl(options);
                        break;
                    case 'scale':
                        control = new maplibregl.ScaleControl(options);
                        break;
                    case 'geolocate':
                        control = new maplibregl.GeolocateControl(options);
                        break;
                    case 'home':
                        control = new HomeControl(options);
                        break;
                    case 'multi-select':
                        control = new MultiSelectControl(options);
                        break;
                    case 'export': {
                        // Lazy load export control to avoid bundling it on initial load
                        const [{ MaplibreExportControl }] = await Promise.all([
                            import('@watergis/maplibre-gl-export'),
                            import('@watergis/maplibre-gl-export/dist/maplibre-gl-export.css')
                        ]);
                        control = new MaplibreExportControl(options);
                        break;
                    }
                    default:
                        console.warn(`Unknown control type: ${type}`);
                }

                if (control) {
                    map.addControl(control, position);
                    controlRefsRef.current.push(control);
                }
            }
        };

        addControls();

        // Remove controls on cleanup
        return () => {
            controlRefsRef.current.forEach(control => {
                map.removeControl(control);
            });
            controlRefsRef.current = [];
        };
    }, [map, controls]);
}
