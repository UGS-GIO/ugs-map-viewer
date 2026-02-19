import { createContext, useContext, useCallback, ReactNode, useMemo, useEffect, useRef, useState } from 'react';
import { useSearch, useNavigate, useLocation } from '@tanstack/react-router';
import { LayerProps } from '@/lib/types/mapping-types';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';

type ActiveFilters = Record<string, string>;

/** Maps group layer titles to their visibility state (default: true) */
type GroupVisibility = Map<string, boolean>;

/** Maps layer titles to their user-set opacity (0–1) */
type LayerOpacity = Map<string, number>;

interface LayerUrlContextType {
    selectedLayerTitles: Set<string>;
    activeFilters: ActiveFilters;
    updateLayerSelection: (titles: string | string[], shouldBeSelected: boolean) => void;
    updateFilter: (layerTitle: string, filterValue: string | undefined) => void;
    /** Whether the layer URL has been initialized (defaults applied if needed) */
    isInitialized: boolean;
    /** Visibility state for group layers (controls child visibility and queryability) */
    groupVisibility: GroupVisibility;
    /** Update a group's visibility state */
    setGroupVisibility: (groupTitle: string, visible: boolean) => void;
    /** User-set opacity overrides for individual layers */
    layerOpacity: LayerOpacity;
    /** Persist a layer's opacity so it survives toggle off/on */
    setLayerOpacity: (title: string, opacity: number) => void;
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

// Check if a group has any visible children by default
const hasVisibleChildren = (layers: LayerProps[]): boolean =>
    layers.some(layer => {
        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            return hasVisibleChildren(layer.layers);
        }
        return layer.visible === true;
    });

// Get default group visibility: false if no children are visible
const getDefaultGroupVisibility = (layers: LayerProps[]): Map<string, boolean> => {
    const visibility = new Map<string, boolean>();
    layers.forEach(layer => {
        if (layer.type === 'group' && layer.title && 'layers' in layer && layer.layers) {
            visibility.set(layer.title, hasVisibleChildren(layer.layers));
            // Recurse for nested groups
            getDefaultGroupVisibility(layer.layers).forEach((v, k) => visibility.set(k, v));
        }
    });
    return visibility;
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

    // isInitialized = URL has a layers key with a selected array (even if empty)
    // This distinguishes between "user explicitly set layers" vs "no layers param in URL"
    const isInitialized = normalizedLayers?.selected !== undefined;

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

        // Only set defaults if layers param is completely missing from URL
        // If user explicitly sets layers.selected = [], respect that (empty map)
        if (!normalizedLayers || normalizedLayers.selected === undefined) {
            finalLayers = { selected: defaultSelected };
            needsUpdate = true;
        } else {
            // Validate existing selection - remove any invalid layer titles
            const currentSelected = normalizedLayers.selected;
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

    // Group visibility state
    const [groupVisibility, setGroupVisibilityState] = useState<GroupVisibility>(() => new Map());

    // Layer opacity overrides (persisted across toggle off/on)
    const [layerOpacity, setLayerOpacityState] = useState<LayerOpacity>(() => new Map());
    const setLayerOpacity = useCallback((title: string, opacity: number) => {
        setLayerOpacityState(prev => { const next = new Map(prev); next.set(title, opacity); return next; });
    }, []);

    // Compute default group visibility from config (groups with no visible children default to false)
    const defaultGroupVisibility = useMemo(() =>
        layersConfig ? getDefaultGroupVisibility(layersConfig) : new Map<string, boolean>()
    , [layersConfig]);

    const setGroupVisibility = useCallback((groupTitle: string, visible: boolean) => {
        setGroupVisibilityState(prev => {
            const next = new Map(prev);
            next.set(groupTitle, visible);
            return next;
        });
    }, []);

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

    // Merge user state with defaults (user state takes precedence)
    const mergedGroupVisibility = useMemo(() => {
        const merged = new Map(defaultGroupVisibility);
        groupVisibility.forEach((v, k) => merged.set(k, v));
        return merged;
    }, [defaultGroupVisibility, groupVisibility]);

    const value = {
        selectedLayerTitles,
        activeFilters,
        updateLayerSelection,
        updateFilter,
        isInitialized,
        groupVisibility: mergedGroupVisibility,
        setGroupVisibility,
        layerOpacity,
        setLayerOpacity,
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