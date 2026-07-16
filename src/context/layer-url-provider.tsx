import { createContext, useContext, useCallback, ReactNode, useMemo, useEffect, useRef } from 'react';
import { useSearch, useNavigate, useLocation } from '@tanstack/react-router';
import { LayerProps } from '@/lib/types/mapping-types';
import { useGetLayerConfigsData } from '@/hooks/use-get-layer-configs';
import { findAncestorGroupTitles } from '@/lib/map/layer-utils';
import { useUserLayers } from '@/context/user-layers-provider';

type ActiveFilters = Record<string, string>;

/** Maps group layer titles to their visibility state (default: true) */
type GroupVisibility = Map<string, boolean>;

/** Maps layer titles to their user-set opacity (0–1) */
type LayerOpacity = Map<string, number>;

interface LayerUrlContextType {
    selectedLayerTitles: Set<string>;
    activeFilters: ActiveFilters;
    /** Select/deselect layers. Selecting also switches the enclosing groups on. */
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

const getAllValidTitles = (layers: LayerProps[]): Set<string> => {
    const titles = new Set<string>();
    layers.forEach(layer => {
        if (layer.title) titles.add(layer.title);
        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            getAllValidTitles(layer.layers).forEach(t => titles.add(t));
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

// Check if a group has any visible (config default) or URL-selected children
export const hasActiveChildren = (layers: LayerProps[], selectedTitles: Set<string>): boolean =>
    layers.some(layer => {
        if (layer.type === 'group' && 'layers' in layer && layer.layers) {
            return hasActiveChildren(layer.layers, selectedTitles);
        }
        return layer.visible === true || selectedTitles.has(layer.title || '');
    });

// Default group toggle state. Explicit `visible` on group wins; otherwise derive from
// whether any child is selected/default-visible. Group `visible: false` lets a config
// author start a group collapsed-off without unselecting its children.
export const getDefaultGroupVisibility = (layers: LayerProps[], selectedTitles: Set<string>): Map<string, boolean> => {
    const visibility = new Map<string, boolean>();
    layers.forEach(layer => {
        if (layer.type === 'group' && layer.title && 'layers' in layer && layer.layers) {
            visibility.set(
                layer.title,
                layer.visible !== undefined
                    ? layer.visible
                    : hasActiveChildren(layer.layers, selectedTitles)
            );
            // Recurse for nested groups
            getDefaultGroupVisibility(layer.layers, selectedTitles).forEach((v, k) => visibility.set(k, v));
        }
    });
    return visibility;
};

interface LayerUrlProviderProps {
    children: ReactNode;
}

export const LayerUrlProvider = ({ children }: LayerUrlProviderProps) => {
    const navigate = useNavigate();

    const {
        layers: urlLayers,
        filters: urlFilters,
        visibility: urlVisibility,
        opacities: urlOpacities
    } = useSearch({ from: '/_map' });

    const layersConfig = useGetLayerConfigsData();
    // User-layer titles are valid immediately (recipes known synchronously), so
    // selection isn't stripped while a remote user layer is still being built.
    // Uploads resolve asynchronously from IndexedDB, so validation also waits on
    // `isHydrated` — otherwise an uploaded layer's title would be stripped from
    // `?layers.selected` before its definition lands, and it'd vanish on reload.
    const { userLayerTitles, isHydrated: userLayersHydrated } = useUserLayers();
    const hasInitializedForPath = useRef<string | null>(null);
    const location = useLocation();



    // isInitialized = URL has a layers key with a selected array (even if empty)
    // This distinguishes between "user explicitly set layers" vs "no layers param in URL"
    const isInitialized = urlLayers?.selected !== undefined;

    useEffect(() => {
        if (!layersConfig || !userLayersHydrated || hasInitializedForPath.current === location.pathname) return;

        const allValidLayerTitles = getAllValidTitles(layersConfig);
        userLayerTitles.forEach(t => allValidLayerTitles.add(t));
        const defaultSelected = getDefaultSelected(layersConfig);

        let finalLayers: { selected?: string[] } | undefined = urlLayers;
        let finalVisibility = urlVisibility;
        let finalFilters = urlFilters;
        let needsUpdate = false;

        if (urlFilters) {
            const validFilterKeys = Object.keys(urlFilters).filter(key => allValidLayerTitles.has(key));
            if (validFilterKeys.length < Object.keys(urlFilters).length) {
                finalFilters = undefined;
                needsUpdate = true;
            }
        }

        // Only set defaults if layers param is completely missing from URL.
        // Empty selection (user turned everything off) is respected.
        const isFreshLoad = !urlLayers || urlLayers.selected === undefined;
        if (isFreshLoad) {
            finalLayers = { selected: defaultSelected };
            needsUpdate = true;
        } else {
            const currentSelected = urlLayers!.selected!;
            const validSelected = currentSelected.filter((title: string) => allValidLayerTitles.has(title));
            if (validSelected.length !== currentSelected.length) {
                finalLayers = { selected: validSelected };
                needsUpdate = true;
            }
        }

        // On a fresh load, seed `?visibility=` from config defaults so shared URLs are
        // self-contained and durable across config edits. If the URL already has visibility,
        // leave it alone.
        if (isFreshLoad && !urlVisibility) {
            const seededSelected = new Set<string>(finalLayers?.selected || []);
            const seededVisibility = getDefaultGroupVisibility(layersConfig, seededSelected);
            if (seededVisibility.size > 0) {
                finalVisibility = Object.fromEntries(seededVisibility);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            // Dedupe to handle StrictMode double-mount
            const dedupedLayers = {
                selected: finalLayers?.selected ? [...new Set(finalLayers.selected)] : undefined,
            };

            navigate({
                to: '.',
                search: (prev) => ({
                    ...prev,
                    layers: dedupedLayers,
                    visibility: finalVisibility,
                    filters: finalFilters,
                }),
                replace: true,
            });
        }

        hasInitializedForPath.current = location.pathname;

    }, [layersConfig, navigate, urlLayers, urlVisibility, urlFilters, location.pathname, userLayerTitles, userLayersHydrated]);

    // structuralSharing on useSearch guarantees stable references for unchanged values
    const selectedLayerTitles = useMemo(
        () => new Set<string>(urlLayers?.selected || []),
        [urlLayers?.selected]
    );

    const activeFilters: ActiveFilters = useMemo(() => urlFilters || {}, [urlFilters]);

    // Compute default group visibility from config defaults AND URL-selected layers
    const defaultGroupVisibility = useMemo(() =>
        layersConfig ? getDefaultGroupVisibility(layersConfig, selectedLayerTitles) : new Map<string, boolean>()
        , [layersConfig, selectedLayerTitles]);

    const layerOpacity = useMemo(
        () => new Map<string, number>(Object.entries(urlOpacities || {})),
        [urlOpacities]
    );

    // URL overrides take precedence over config defaults
    const mergedGroupVisibility = useMemo(() => {
        const merged = new Map(defaultGroupVisibility);
        if (urlVisibility) {
            Object.entries(urlVisibility).forEach(([k, v]) => {
                merged.set(k, Boolean(v));
            });
        }
        return merged;
    }, [defaultGroupVisibility, urlVisibility]);

    const setLayerOpacity = useCallback((title: string, opacity: number) => {
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                opacities: {
                    ...(prev.opacities || {}),
                    [title]: opacity,
                }
            }),
            replace: true,
        });
    }, [navigate]);

    const setGroupVisibility = useCallback((groupTitle: string, visible: boolean) => {
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                visibility: {
                    ...(prev.visibility || {}),
                    [groupTitle]: visible,
                }
            }),
            replace: true,
        });
    }, [navigate]);

    const updateLayerSelection = useCallback((titles: string | string[], shouldBeSelected: boolean) => {
        const titlesToUpdate = Array.isArray(titles) ? titles : [titles];

        // Switch enclosing groups on in the same navigation as the selection: a group
        // toggled off hides its whole subtree (`resolveLeafVisibility`), and a second
        // navigate() in the same tick would just re-derive `prev` and drop this write.
        const groupsToShow = shouldBeSelected && layersConfig
            ? [...new Set(titlesToUpdate.flatMap(title => findAncestorGroupTitles(layersConfig, title)))]
            : [];

        navigate({
            to: '.',
            search: (prev) => {
                const currentSelected = new Set(prev.layers?.selected || []);
                const currentFilters = { ...(prev.filters || {}) };
                const currentVisibility = { ...(prev.visibility || {}) };
                let changed = false;

                if (shouldBeSelected) {
                    titlesToUpdate.forEach(title => {
                        if (!currentSelected.has(title)) { currentSelected.add(title); changed = true; }
                    });
                    groupsToShow.forEach(group => {
                        if (currentVisibility[group] !== true) { currentVisibility[group] = true; changed = true; }
                    });
                } else {
                    titlesToUpdate.forEach(title => {
                        if (currentSelected.delete(title)) changed = true;
                        if (title in currentFilters) { delete currentFilters[title]; changed = true; }
                    });
                }

                // Idempotent: callers re-assert selection freely, so a no-op must return
                // `prev` unchanged rather than loop the effects that called us.
                if (!changed) return prev;

                return {
                    ...prev,
                    layers: { selected: Array.from(currentSelected) },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                    visibility: Object.keys(currentVisibility).length > 0 ? currentVisibility : undefined,
                };
            },
            replace: true,
        });
    }, [navigate, layersConfig]);

    const updateFilter = useCallback((layerTitle: string, filterValue: string | undefined) => {
        // Applying a filter selects the layer, so reveal its groups too — same invariant
        // as updateLayerSelection, or a filtered layer inside an off group stays hidden.
        const groupsToShow = filterValue && layersConfig
            ? findAncestorGroupTitles(layersConfig, layerTitle)
            : [];
        navigate({
            to: '.',
            search: (prev) => {
                const currentFilters = { ...(prev.filters || {}) };
                const currentSelected = new Set(prev.layers?.selected || []);
                const currentVisibility = { ...(prev.visibility || {}) };

                if (filterValue) {
                    currentFilters[layerTitle] = filterValue;
                    currentSelected.add(layerTitle);
                    groupsToShow.forEach(group => { currentVisibility[group] = true; });
                } else {
                    delete currentFilters[layerTitle];
                }

                return {
                    ...prev,
                    layers: { selected: Array.from(currentSelected) },
                    filters: Object.keys(currentFilters).length > 0 ? currentFilters : undefined,
                    visibility: Object.keys(currentVisibility).length > 0 ? currentVisibility : undefined,
                };
            },
            replace: true
        });
    }, [navigate, layersConfig]);

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