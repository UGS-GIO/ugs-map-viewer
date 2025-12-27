import { useLayerUrl } from '@/context/layer-url-provider';
import { LayerProps } from '@/lib/types/mapping-types';

const getChildLayerTitles = (layer: LayerProps): string[] => {
    if ('layers' in layer && layer.type === 'group') {
        return (layer.layers || []).flatMap(child => getChildLayerTitles(child));
    }
    return layer.title ? [layer.title] : [];
};

export const useLayerItemState = (layerConfig: LayerProps) => {
    const { selectedLayerTitles, updateLayerSelection } = useLayerUrl();

    const title = layerConfig.title || '';

    // SINGLE LAYER LOGIC
    if (layerConfig.type !== 'group') {
        const isSelected = selectedLayerTitles.has(title);

        const handleToggleSelection = (select: boolean) => {
            if (title) {
                updateLayerSelection(title, select);
            }
        };

        return {
            isSelected,
            handleToggleSelection,
            isGroupVisible: true,
            groupCheckboxState: null,
            handleSelectAllToggle: () => { },
        };
    }
    // GROUP LAYER LOGIC
    else {
        const childTitles = getChildLayerTitles(layerConfig);
        const selectedChildrenCount = childTitles.filter(t => selectedLayerTitles.has(t)).length;

        let groupCheckboxState: 'all' | 'some' | 'none' = 'none';
        if (selectedChildrenCount === childTitles.length && childTitles.length > 0) {
            groupCheckboxState = 'all';
        } else if (selectedChildrenCount > 0) {
            groupCheckboxState = 'some';
        }

        const handleSelectAllToggle = () => {
            const shouldSelectAll = groupCheckboxState !== 'all';
            updateLayerSelection(childTitles, shouldSelectAll);
        };

        // Group is visible on map if any children are selected
        const isGroupVisible = selectedChildrenCount > 0;

        return {
            isSelected: false,
            handleToggleSelection: () => { },
            isGroupVisible,
            groupCheckboxState,
            handleSelectAllToggle,
        };
    }
};