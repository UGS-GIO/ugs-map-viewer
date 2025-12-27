import { useMemo } from 'react';
import { LayerProps } from '@/lib/types/mapping-types';

/**
 * Applies URL-based layer selection to layer configs.
 *
 * - If not initialized yet, returns layers with default visibility
 * - Once initialized, sets visibility based on whether layer title is in the selection
 * - Empty selection = all layers hidden (user turned them all off)
 * - Groups are visible if any child is visible
 */
export function useLayerVisibility(
    layers: LayerProps[],
    selectedLayerTitles: Set<string>,
    isInitialized: boolean = true
): LayerProps[] {
    return useMemo(() => {
        // Not initialized yet - return layers with their default visibility
        if (!isInitialized) {
            return layers;
        }

        // Apply selection to layers - empty selection means all layers are hidden
        const applySelection = (layerArray: LayerProps[]): LayerProps[] =>
            layerArray.map(layer => {
                if (layer.type === 'group' && 'layers' in layer) {
                    const children = applySelection(layer.layers || []);
                    return { ...layer, layers: children, visible: children.some(c => c.visible) };
                }
                return { ...layer, visible: selectedLayerTitles.has(layer.title || '') };
            });

        return applySelection(layers);
    }, [layers, selectedLayerTitles, isInitialized]);
}