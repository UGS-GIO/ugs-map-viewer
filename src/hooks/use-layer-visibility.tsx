import { useMemo } from 'react';
import { LayerProps } from '@/lib/types/mapping-types';

/**
 * Processes layer visibility based on selected layers.
 * A layer is visible if it is in selectedLayerTitles.
 * A group is visible if any of its children are visible.
 * @param layers - Array of layer configurations.
 * @param selectedLayerTitles - Set of titles of selected layers.
 * @return Processed array of layers with updated visibility.
 */
export function useLayerVisibility(
    layers: LayerProps[],
    selectedLayerTitles: Set<string>
) {
    return useMemo(() => {
        const processLayers = (layerArray: LayerProps[]): LayerProps[] => {
            return layerArray.map(layer => {
                if (layer.type === 'group' && 'layers' in layer) {
                    const newChildLayers = processLayers(layer.layers || []);
                    const isGroupVisible = newChildLayers.some(child => child.visible);
                    return { ...layer, visible: isGroupVisible, layers: newChildLayers };
                }

                // A layer is visible if it's in selected
                const isVisible = selectedLayerTitles.has(layer.title || '');
                return { ...layer, visible: isVisible };
            });
        };

        return processLayers(layers);
    }, [layers, selectedLayerTitles]);
}