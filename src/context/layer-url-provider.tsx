import { createContext, useContext, useCallback, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useSearch, useNavigate, useLocation } from '@tanstack/react-router';
import { LayerProps } from '@/lib/types/mapping-types';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';

type ActiveFilters = Record<string, string>;

interface LayerUrlContextType {
    selectedLayerTitles: Set<string>;
    activeFilters: ActiveFilters;
    updateLayerSelection: (titles: string | string[], shouldBeSelected: boolean) => void;
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

const getDefaultSelected = (layers: LayerProps[]): string[] => {
    const selected: string[] = [];
    layers.forEach(layer => {
        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            selected.push(...getDefaultSelected(layer.layers));
        } else if (layer.visible && layer.title) {
            selected.push(layer.title);
        }
    });
    return selected;
};

const normalizeLayersObj = (layers: string | { selected?: string[] } | undefined): { selected?: string[] } => {
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
        const defaultSelected = getDefaultSelected(layersConfig);

        let finalLayers: { selected?: string[] } = normalizedLayers;
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
            finalLayers = { selected: defaultSelected };
            needsUpdate = true;
        } else {
            const currentSelected = normalizedLayers.selected || [];
            const validSelected = currentSelected.filter((title: string) => allValidLayerTitles.has(title));
            if (validSelected.length !== currentSelected.length) {
                finalLayers = { selected: validSelected };
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            // Dedupe to handle StrictMode double-mount
            const dedupedLayers = {
                selected: finalLayers.selected ? [...new Set(finalLayers.selected)] : undefined,
            };

            navigate({
                to: '.',
                search: (prev) => ({ ...prev, layers: dedupedLayers, filters: finalFilters }),
                replace: true
            });
        }

        hasInitializedForPath.current = location.pathname;

    }, [layersConfig, navigate, normalizedLayers, urlFilters, location.pathname]);

    // Memoize based on array contents, not object reference
    const selectedLayerTitles = useMemo(
        () => new Set<string>(normalizedLayers?.selected || []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(normalizedLayers?.selected)]
    );
    const activeFilters: ActiveFilters = useMemo(() => urlFilters || {}, [urlFilters]);

    const updateLayerSelection = useCallback((titles: string | string[], shouldBeSelected: boolean) => {
        const titlesToUpdate = Array.isArray(titles) ? titles : [titles];

        navigate({
            to: '.',
            search: (prev) => {
                const prevLayersObj = normalizeLayersObj(prev.layers);
                const currentSelected = new Set(prevLayersObj?.selected || []);
                const currentFilters = { ...(prev.filters || {}) };

                if (shouldBeSelected) {
                    titlesToUpdate.forEach(title => currentSelected.add(title));
                } else {
                    titlesToUpdate.forEach(title => {
                        currentSelected.delete(title);
                        delete currentFilters[title];
                    });
                }

                return {
                    ...prev,
                    layers: { selected: Array.from(currentSelected) },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                };
            },
            replace: true,
        });
    }, [navigate]);

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
                    layers: { selected: Array.from(currentSelected) },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                };
            },
            replace: true
        });
    }, [navigate]);

    const value = {
        selectedLayerTitles,
        activeFilters,
        updateLayerSelection,
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