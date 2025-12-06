import { useEffect, useRef } from 'react';
import { MultiSelectControl } from '@/lib/map/controls/multi-select-control';
import { useMultiSelect } from '@/context/multi-select-context';
import type { MapLibreMap } from '@/lib/types/map-types';

/**
 * Hook to add and manage the multi-select control
 * Connects the MapLibre control to React context state
 */
export function useMultiSelectControl(map: MapLibreMap | undefined) {
    const controlRef = useRef<MultiSelectControl | null>(null);
    const { isMultiSelectMode, setMultiSelectMode } = useMultiSelect();

    useEffect(() => {
        if (!map) {
            return;
        }

        // Create control with callbacks
        const control = new MultiSelectControl({
            onToggle: (enabled) => {
                setMultiSelectMode(enabled);
            },
            onCancel: () => {
                setMultiSelectMode(false);
            }
        });

        // Add control to map
        map.addControl(control, 'top-left')
        controlRef.current = control;

        // Cleanup
        return () => {
            if (controlRef.current) {
                map.removeControl(controlRef.current);
                controlRef.current = null;
            }
        };
    }, [map, setMultiSelectMode]);

    // Sync control state with context state
    useEffect(() => {
        if (controlRef.current) {
            controlRef.current.setEnabled(isMultiSelectMode);
        }
    }, [isMultiSelectMode]);

    return controlRef.current;
}
