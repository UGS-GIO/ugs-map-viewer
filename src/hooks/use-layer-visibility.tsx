import { useMemo } from 'react';
import { LayerProps } from '@/lib/types/mapping-types';

/**
 * Applies URL-based layer selection and group visibility to layer configs.
 *
 * - If not initialized yet, returns layers with default visibility
 * - Once initialized, sets visibility based on whether layer title is in the selection
 * - Empty selection = all layers hidden (user turned them all off)
 * - Groups are visible if any child is visible AND group toggle is on
 * - Group visibility toggle affects whether children are queryable
 */
export function useLayerVisibility(
    layers: LayerProps[],
    selectedLayerTitles: Set<string>,
    isInitialized: boolean = true,
    groupVisibility?: Map<string, boolean>,
    layerOpacity?: Map<string, number>
): LayerProps[] {
    return useMemo(() => {
        // Not initialized yet - return layers with their default visibility
        if (!isInitialized) {
            return layers;
        }

        // Apply selection to layers - empty selection means all layers are hidden
        // Group visibility toggle overrides child visibility when off
        const applySelection = (layerArray: LayerProps[], parentGroupVisible: boolean = true): LayerProps[] =>
            layerArray.map(layer => {
                if (layer.type === 'group' && 'layers' in layer) {
                    // Check if this group's visibility toggle is on (default: true)
                    const groupToggleVisible = groupVisibility?.get(layer.title || '') ?? true;
                    const children = applySelection(layer.layers || [], groupToggleVisible);
                    // Group is visible only if toggle is on AND at least one child is selected
                    const hasSelectedChildren = children.some(c => selectedLayerTitles.has(c.title || ''));
                    return {
                        ...layer,
                        layers: children,
                        visible: groupToggleVisible && hasSelectedChildren
                    };
                }
                // Child layer is visible if selected AND parent group toggle is on
                const isSelected = selectedLayerTitles.has(layer.title || '');
                const opacityOverride = layerOpacity?.get(layer.title || '');
                return {
                    ...layer,
                    visible: isSelected && parentGroupVisible,
                    ...(opacityOverride !== undefined && { opacity: opacityOverride }),
                };
            });

        return applySelection(layers);
    }, [layers, selectedLayerTitles, isInitialized, groupVisibility, layerOpacity]);
}