import { useMemo } from 'react';
import { LayerProps } from '@/lib/types/mapping-types';

/**
 * Applies URL-based layer selection to layer configs.
 *
 * - If selectedLayerTitles is empty (URL not initialized), returns layers unchanged
 * - Otherwise, sets visibility based on whether layer title is in the selection
 * - Groups are visible if any child is visible
 */
export function useLayerVisibility(
    layers: LayerProps[],
    selectedLayerTitles: Set<string>
): LayerProps[] {
    return useMemo(() => {
        // Not initialized yet - return layers with their default visibility
        if (selectedLayerTitles.size === 0) {
            return layers;
        }

        // Apply selection to layers
        const applySelection = (layerArray: LayerProps[]): LayerProps[] =>
            layerArray.map(layer => {
                if (layer.type === 'group' && 'layers' in layer) {
                    const children = applySelection(layer.layers || []);
                    return { ...layer, layers: children, visible: children.some(c => c.visible) };
                }
                return { ...layer, visible: selectedLayerTitles.has(layer.title || '') };
            });

        return applySelection(layers);
    }, [layers, selectedLayerTitles]);
}