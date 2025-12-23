import { useEffect, useRef } from 'react';
import { MultiSelectControl } from '@/lib/map/controls/multi-select-control';
import { useMultiSelect } from '@/context/multi-select-context';
import type { MapLibreMap } from '@/lib/types/map-types';

/**
 * Hook to add and manage the selection tool control
 * Connects the MapLibre control to React context state
 */
export function useMultiSelectControl(map: MapLibreMap | undefined) {
    const controlRef = useRef<MultiSelectControl | null>(null);
    const {
        isMultiSelectMode,
        setMultiSelectMode,
        selectionMode,
        setSelectionMode,
        clearSelectedFeatures
    } = useMultiSelect();

    useEffect(() => {
        if (!map) {
            return;
        }

        // Create control with callbacks
        const control = new MultiSelectControl({
            initialMode: selectionMode,
            onToggle: (enabled) => {
                setMultiSelectMode(enabled);
                if (!enabled) {
                    clearSelectedFeatures();
                }
            },
            onCancel: () => {
                setMultiSelectMode(false);
                clearSelectedFeatures();
            },
            onModeChange: (mode) => {
                setSelectionMode(mode);
                clearSelectedFeatures();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // Sync control state with context state
    useEffect(() => {
        if (controlRef.current) {
            controlRef.current.setEnabled(isMultiSelectMode);
        }
    }, [isMultiSelectMode]);

    // Sync mode with context
    useEffect(() => {
        if (controlRef.current) {
            controlRef.current.setMode(selectionMode);
        }
    }, [selectionMode]);

    return controlRef.current;
}
