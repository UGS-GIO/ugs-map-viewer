import { createContext, useContext, useCallback, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useSearch, useNavigate, useLocation } from '@tanstack/react-router';
import { LayerProps } from '@/lib/types/mapping-types';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';

type ActiveFilters = Record<string, string>;

interface LayerUrlContextType {
    selectedLayerTitles: Set<string>;
    hiddenGroupTitles: Set<string>;
    activeFilters: ActiveFilters;
    updateLayerSelection: (titles: string | string[], shouldBeSelected: boolean) => void;
    toggleGroupVisibility: (title: string) => void;
    updateFilter: (layerTitle: string, filterValue: string | undefined) => void;
}

const LayerUrlContext = createContext<LayerUrlContextType | undefined>(undefined);

const getAllValidTitles = (layers: LayerProps[], groupsOnly = false): Set<string> => {
    const titles = new Set<string>();
    layers.forEach(layer => {
        if (layer.type === 'group' && layer.title) {
            titles.add(layer.title);
            if ('layers' in layer && layer.layers) {
                getAllValidTitles(layer.layers, groupsOnly).forEach(t => titles.add(t));
            }
        } else if (!groupsOnly && layer.title) {
            titles.add(layer.title);
        }
    });
    return titles;
};

const getDefaultVisible = (layers: LayerProps[]): { selected: string[], hidden: string[] } => {
    let selected: string[] = [];
    let hidden: string[] = [];
    layers.forEach(layer => {
        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            if (layer.visible === false && layer.title) hidden.push(layer.title);
            const children = getDefaultVisible(layer.layers);
            selected.push(...children.selected);
            hidden.push(...children.hidden);
        } else if (layer.visible && layer.title) {
            selected.push(layer.title);
        }
    });
    return { selected, hidden };
};

const normalizeLayersObj = (layers: string | { selected?: string[]; hidden?: string[] } | undefined): { selected?: string[]; hidden?: string[] } => {
    if (typeof layers === 'string') {
        try {
            return JSON.parse(layers);
        } catch {
            return {};
        }
    }
    return layers || {};
};

interface LayerUrlProviderProps {
    children: ReactNode;
}

export const LayerUrlProvider = ({ children }: LayerUrlProviderProps) => {
    const navigate = useNavigate();
    const { layers: urlLayers, filters: urlFilters } = useSearch({ from: '/_map' });
    const layersConfig = useGetLayerConfigsData();
    const hasInitializedForPath = useRef<string | null>(null);
    const location = useLocation();

    // Normalize layers: handle both string and object formats
    const normalizedLayers = useMemo(() => normalizeLayersObj(urlLayers), [urlLayers]);

    useEffect(() => {
        if (!layersConfig || hasInitializedForPath.current === location.pathname) return;

        const allValidLayerTitles = getAllValidTitles(layersConfig);
        const defaults = getDefaultVisible(layersConfig);

        let finalLayers: any = normalizedLayers;
        let finalFilters = urlFilters;
        let needsUpdate = false;

        if (urlFilters) {
            const validFilterKeys = Object.keys(urlFilters).filter(key => allValidLayerTitles.has(key));
            if (validFilterKeys.length < Object.keys(urlFilters).length) {
                finalFilters = undefined;
                needsUpdate = true;
            }
        }

        if (!normalizedLayers || !normalizedLayers.selected || normalizedLayers.selected.length === 0) {
            finalLayers = { ...normalizedLayers, ...defaults };
            needsUpdate = true;
        } else {
            const currentSelected = normalizedLayers.selected || [];
            const validSelected = currentSelected.filter((title: string) => allValidLayerTitles.has(title));
            if (validSelected.length !== currentSelected.length) {
                finalLayers = { ...normalizedLayers, selected: validSelected };
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            navigate({
                to: '.',
                search: (prev) => ({ ...prev, layers: finalLayers, filters: finalFilters }),
                replace: true
            });
        }

        hasInitializedForPath.current = location.pathname;

    }, [layersConfig, navigate, normalizedLayers, urlFilters, location.pathname]);

    // Create a map to find a layer's parent group title
    const childToParentMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!layersConfig) return map;

        const traverse = (layers: LayerProps[], parent: LayerProps) => {
            for (const layer of layers) {
                // Ensure the parent is a group and has a title before setting the map
                if (parent.type === 'group' && parent.title && layer.title) {
                    map.set(layer.title, parent.title);
                }

                // Use a type guard to confirm 'layer' is a group before recursing
                if (layer.type === 'group' && 'layers' in layer && layer.layers) {
                    traverse(layer.layers, layer);
                }
            }
        };

        // Start the traversal for each top-level item
        for (const layer of layersConfig) {
            // Use a type guard on the top-level items as well
            if (layer.type === 'group' && 'layers' in layer && layer.layers) {
                traverse(layer.layers, layer);
            }
        }

        return map;
    }, [layersConfig]);

    const selectedLayerTitles = useMemo(() => new Set<string>(normalizedLayers?.selected || []), [normalizedLayers]);
    const hiddenGroupTitles = useMemo(() => new Set<string>(normalizedLayers?.hidden || []), [normalizedLayers]);
    const activeFilters: ActiveFilters = useMemo(() => urlFilters || {}, [urlFilters]);

    // This function now turns on the parent group when a child is selected
    const updateLayerSelection = useCallback((titles: string | string[], shouldBeSelected: boolean) => {
        const titlesToUpdate = Array.isArray(titles) ? titles : [titles];

        console.log('[LayerUrlProvider] updateLayerSelection called:', {
            titles: titlesToUpdate,
            shouldBeSelected
        });

        navigate({
            to: '.',
            search: (prev) => {
                const prevLayersObj = normalizeLayersObj(prev.layers);
                const currentSelected = new Set(prevLayersObj?.selected || []);
                const currentHidden = new Set(prevLayersObj?.hidden || []);
                const currentFilters = { ...(prev.filters || {}) };

                console.log('[LayerUrlProvider] Current state before update:', {
                    currentSelected: Array.from(currentSelected),
                    currentFilters
                });

                if (shouldBeSelected) {
                    titlesToUpdate.forEach(title => {
                        currentSelected.add(title);
                        // If selecting a child, ensure its parent group is not hidden
                        const parentTitle = childToParentMap.get(title);
                        if (parentTitle) {
                            currentHidden.delete(parentTitle);
                        }
                    });
                } else {
                    titlesToUpdate.forEach(title => {
                        currentSelected.delete(title);
                        delete currentFilters[title];
                    });
                }

                const newState = {
                    ...prev,
                    layers: {
                        ...prevLayersObj,
                        selected: Array.from(currentSelected),
                        hidden: Array.from(currentHidden),
                    },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                };

                console.log('[LayerUrlProvider] New state after update:', {
                    selected: newState.layers.selected,
                    filters: newState.filters
                });

                return newState;
            },
            replace: true,
        });
    }, [navigate, childToParentMap]);

    const updateFilter = useCallback((layerTitle: string, filterValue: string | undefined) => {
        navigate({
            to: '.',
            search: (prev) => {
                const prevLayersObj = normalizeLayersObj(prev.layers);
                const currentFilters = { ...(prev.filters || {}) };
                const currentSelected = new Set(prevLayersObj?.selected || []);

                if (filterValue) {
                    currentFilters[layerTitle] = filterValue;
                    currentSelected.add(layerTitle);
                } else {
                    delete currentFilters[layerTitle];
                }

                return {
                    ...prev,
                    layers: { ...prevLayersObj, selected: Array.from(currentSelected) },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                };
            },
            replace: true
        });
    }, [navigate]);

    const toggleGroupVisibility = useCallback((title: string) => {
        navigate({
            to: '.',
            search: (prev) => {
                const prevLayersObj = normalizeLayersObj(prev.layers);
                const newHiddenSet = new Set(prevLayersObj?.hidden || []);
                if (newHiddenSet.has(title)) {
                    newHiddenSet.delete(title);
                } else {
                    newHiddenSet.add(title);
                }
                return {
                    ...prev,
                    layers: { ...prevLayersObj, hidden: Array.from(newHiddenSet) }
                };
            },
            replace: true
        });
    }, [navigate]);

    const value = {
        selectedLayerTitles,
        hiddenGroupTitles,
        activeFilters,
        updateLayerSelection,
        toggleGroupVisibility,
        updateFilter,
    };

    return (
        <LayerUrlContext.Provider value={value}>
            {children}
        </LayerUrlContext.Provider>
    );
};

export const useLayerUrl = () => {
    const context = useContext(LayerUrlContext);
    if (!context) throw new Error('useLayerUrl must be used within a LayerUrlProvider');
    return context;
};