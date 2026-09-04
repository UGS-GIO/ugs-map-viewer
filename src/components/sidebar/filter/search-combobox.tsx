import { useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQueries, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandSeparator } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FeatureCollection, Geometry, GeoJsonProperties, Feature } from 'geojson';
import { featureCollection, point as turfPoint } from '@turf/helpers';
import { useDebounce } from 'use-debounce';
import { MASQUERADE_GEOCODER_URL } from '@/lib/constants';
import { useMap } from '@/hooks/use-map';
import { clearGraphics } from '@/lib/map/highlight-utils';
import { useToast } from "@/hooks/use-toast";
import { useLayerUrl } from '@/context/layer-url-provider';

import type {
    SearchSourceConfig,
    PostgRESTConfig,
    MasqueradeConfig,
    Suggestion,
    QueryData,
    QueryResultWrapper,
    SearchComboboxHandle,
    SearchComboboxProps,
} from './search-types';
import { formatAddressCase, getDisplayValue, getSourceDisplayName, resultHasData, appendFunctionParams, resolveDefaultSourceIndex } from './search-utils';
import { fetchMasqueradeSuggestions, fetchPostgRESTResults } from './search-fetchers';

// Re-export types and handlers for consumers
export type { SearchSourceConfig, MasqueradeConfig, PostgRESTConfig, SearchComboboxHandle, ExtendedGeometry } from './search-types';
export { handleSearchSelect, handleCollectionSelect } from './search-handlers';

export const defaultMasqueradeConfig: SearchSourceConfig = {
    type: 'masquerade',
    url: MASQUERADE_GEOCODER_URL,
    sourceName: 'Address or City Search',
    displayField: 'text',
    outSR: 4326,
};

const SearchCombobox = forwardRef<SearchComboboxHandle, SearchComboboxProps>(function SearchCombobox({
    config,
    onFeatureSelect,
    onCollectionSelect,
    className,
    defaultSourceName,
}, ref) {
    // Source to pre-select on load / restore on clear; null = search all sources.
    const defaultSourceIndex = useMemo(
        () => resolveDefaultSourceIndex(config, defaultSourceName),
        [config, defaultSourceName],
    );
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch] = useDebounce(search, 500);
    const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(defaultSourceIndex);
    const [isShaking, setIsShaking] = useState(false);
    const { map } = useMap();
    const commandRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { updateLayerSelection } = useLayerUrl();

    // Mutation for fetching geometries from a PostgREST function (on selection)
    const geometryMutation = useMutation({
        mutationFn: async ({ searchParams, sourceConfig }: { searchParams: Record<string, string>; sourceConfig: PostgRESTConfig }) => {
            const params = new URLSearchParams(searchParams);
            appendFunctionParams(params, sourceConfig);
            const url = `${sourceConfig.url}/rpc/${sourceConfig.functionName}?${params.toString()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { ...sourceConfig.headers, 'Accept': 'application/geo+json' },
            });
            if (!response.ok) throw new Error(`Failed to fetch geometries: ${response.status}`);
            return response.json();
        },
    });

    // Mutation for fetching Masquerade address candidates (on selection)
    const addressCandidateMutation = useMutation({
        mutationFn: async ({ magicKey, sourceConfig }: { magicKey: string; sourceConfig: MasqueradeConfig }) => {
            const params = new URLSearchParams();
            params.set('magicKey', magicKey);
            params.set('outFields', '*');
            params.set('maxLocations', '1');
            params.set('outSR', JSON.stringify({ wkid: sourceConfig.outSR ?? 4326 }));
            params.set('f', 'json');

            const candidatesUrl = `${sourceConfig.url}/findAddressCandidates?${params.toString()}`;
            const response = await fetch(candidatesUrl, { method: 'GET', headers: sourceConfig.headers });
            if (!response.ok) throw new Error(`findAddressCandidates failed: ${response.status}`);
            return response.json();
        },
    });

    const isAnyMutationPending = geometryMutation.isPending || addressCandidateMutation.isPending;

    // Re-assert selection on every hit — the layer's group may have been switched off
    // since it was checked. DataMap derives layer visibility from this URL state, so no
    // imperative map flip is needed (it would only be clobbered on the next render).
    const ensureLayerVisibleByTitle = useCallback((layerTitle: string | undefined) => {
        if (!layerTitle) return;
        updateLayerSelection(layerTitle, true);
    }, [updateLayerSelection]);

    const clearSearch = useCallback(() => {
        setInputValue('');
        setSearch('');
        setActiveSourceIndex(defaultSourceIndex);
        setOpen(false);
        if (map) clearGraphics(map);
    }, [map, defaultSourceIndex]);

    useImperativeHandle(ref, () => ({ clear: clearSearch }), [clearSearch]);

    const placeholderText = useMemo(() => {
        if (activeSourceIndex !== null && config[activeSourceIndex]) {
            return `Search in ${getSourceDisplayName(config[activeSourceIndex])}...`;
        }
        return config[0]?.placeholder || `Search...`;
    }, [activeSourceIndex, config]);

    // Typeahead queries — delegates to source-specific fetchers
    const queries = useQueries({
        queries: config.map((source, index) => ({
            queryKey: queryKeys.sidebar.search(source.url, source.type, debouncedSearch, index),
            queryFn: async (): Promise<QueryData> => {
                if (source.type === 'masquerade') {
                    return fetchMasqueradeSuggestions(source, debouncedSearch);
                }
                return fetchPostgRESTResults(source, debouncedSearch, index);
            },
            enabled: (
                !!debouncedSearch &&
                debouncedSearch.trim().length >= 2 &&
                (activeSourceIndex === null || activeSourceIndex === index)
            ),
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 300000,
            gcTime: 600000,
        }))
    });

    const queryResults = useMemo<QueryResultWrapper[]>(() =>
        queries.map((query, index) => ({
            data: query.data,
            error: query.error,
            isLoading: query.isLoading,
            isError: query.isError,
            type: config[index].type
        })), [queries, config]);

    const isLoading = queryResults.some(result => result.isLoading);

    const handleSourceFilterSelect = (sourceIndex: number) => {
        setActiveSourceIndex(sourceIndex === activeSourceIndex ? null : sourceIndex);
        setInputValue('');
        setSearch('');
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleResultSelect = async (
        value: string,
        sourceIndex: number,
        itemData: Feature<Geometry, GeoJsonProperties> | Suggestion,
        searchConfig: SearchSourceConfig[]
    ) => {
        if (!map) return;

        const sourceConfig = config[sourceIndex];

        // Masquerade: fetch address candidate → create point → zoom
        if (sourceConfig.type === 'masquerade' && 'magicKey' in itemData) {
            setInputValue(formatAddressCase(itemData.text));
            try {
                const data = await addressCandidateMutation.mutateAsync({
                    magicKey: itemData.magicKey,
                    sourceConfig
                });
                if (data?.candidates?.length > 0) {
                    const bestCandidate = data.candidates[0];
                    const feature: Feature<Geometry, GeoJsonProperties> = {
                        type: "Feature",
                        geometry: turfPoint([bestCandidate.location.x, bestCandidate.location.y]).geometry,
                        properties: {
                            ...bestCandidate.attributes,
                            matchAddress: bestCandidate.address,
                            score: bestCandidate.score,
                            [sourceConfig.displayField || 'address']: bestCandidate.address
                        }
                    };
                    onFeatureSelect?.(feature, sourceConfig.url, sourceIndex, searchConfig, map);
                }
            } catch (error) {
                console.error("Error fetching address candidates:", error);
            }
            setOpen(false);
            return;
        }

        // PostgREST: use feature directly, or fetch geometry if missing
        if (sourceConfig.type === 'postgREST' && 'type' in itemData && itemData.type === 'Feature') {
            const displayValue = getDisplayValue(itemData.properties, sourceConfig);
            setInputValue(displayValue || value);
            ensureLayerVisibleByTitle(sourceConfig.layerName);

            let result: Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, GeoJsonProperties> | null = itemData;

            if (!itemData.geometry && sourceConfig.functionName) {
                const searchValue = itemData.properties?.[sourceConfig.displayField];
                if (searchValue) {
                    try {
                        const data = await geometryMutation.mutateAsync({
                            searchParams: { search_key: searchValue },
                            sourceConfig,
                        });
                        let features: Feature<Geometry, GeoJsonProperties>[] = [];
                        if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
                            features = data.features;
                        } else if (Array.isArray(data) && data.length > 0 && data[0]?.type === 'Feature') {
                            features = data;
                        }
                        if (features.length === 1) result = features[0];
                        else if (features.length > 1) result = featureCollection(features);
                    } catch (error) {
                        console.error("Error fetching feature geometry:", error);
                    }
                }
            }

            onFeatureSelect?.(result, sourceConfig.url, sourceIndex, searchConfig, map);
        }

        setOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            const selectedItem = commandRef.current?.querySelector('[role="option"][data-selected="true"]');
            const isSourceFilterSelected = selectedItem?.getAttribute('value')?.startsWith('##source-');
            if (!selectedItem || isSourceFilterSelected) {
                event.preventDefault();
                executeCollectionSearch(search, config);
            }
        }
    };

    const executeCollectionSearch = async (currentSearchTerm: string, searchConfig: SearchSourceConfig[]) => {
        if (isLoading && currentSearchTerm.trim().length > 3) {
            toast({ variant: "default", description: "Loading results... Press Enter again when ready.", duration: 2000 });
            return;
        }

        let allVisibleFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
        let firstValidSourceUrl: string | null = null;
        let firstValidSourceIndex: number = -1;
        let needsGeometryFetch = false;
        const indicesToCheck = activeSourceIndex !== null ? [activeSourceIndex] : config.map((_, index) => index);

        for (const index of indicesToCheck) {
            const sourceResult = queryResults[index];
            if (sourceResult?.data && sourceResult.type === 'postgREST' && 'features' in sourceResult.data && Array.isArray(sourceResult.data.features)) {
                const sourceConfig = config[index];
                if (sourceConfig?.type === 'postgREST' && sourceResult.data.features.length > 0) {
                    allVisibleFeatures = allVisibleFeatures.concat(sourceResult.data.features);
                    if (firstValidSourceIndex === -1) {
                        firstValidSourceUrl = sourceConfig.url;
                        firstValidSourceIndex = index;
                    }
                    if (!sourceResult.data.features[0]?.geometry) needsGeometryFetch = true;
                    ensureLayerVisibleByTitle(sourceConfig.layerName);
                }
            }
        }

        // Fetch geometry for features that don't have it
        if (needsGeometryFetch && allVisibleFeatures.length > 0 && firstValidSourceIndex !== -1) {
            const sourceConfig = searchConfig[firstValidSourceIndex] as PostgRESTConfig;
            if (sourceConfig.functionName && sourceConfig.searchTerm) {
                try {
                    const data = await geometryMutation.mutateAsync({
                        searchParams: { [sourceConfig.searchTerm]: `%${currentSearchTerm}%` },
                        sourceConfig,
                    });
                    if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
                        allVisibleFeatures = data.features;
                    }
                } catch (error) {
                    console.error('Error fetching geometries for collection:', error);
                }
            }
        }

        const combinedCollection = allVisibleFeatures.length > 0 ? featureCollection(allVisibleFeatures) : null;

        if (map) {
            onCollectionSelect?.(combinedCollection, firstValidSourceUrl, firstValidSourceIndex, searchConfig, map);
        }

        if (combinedCollection !== null) {
            setOpen(false);
            setInputValue(`Results for "${currentSearchTerm}"`);
        } else {
            const errorMessage = currentSearchTerm === ''
                ? 'Please enter a search term'
                : `No results for "${currentSearchTerm}. If searching for an address, please select a suggestion.`;
            const shakingDuration = 650;
            setIsShaking(true);
            toast({ variant: "destructive", title: "Search Failed", description: errorMessage, duration: shakingDuration * 3 });
            setInputValue('');
            setTimeout(() => setIsShaking(false), shakingDuration);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
                <div className="relative flex items-center">
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            data-tour="search-box"
                            className={cn(className, 'w-full', 'justify-between', 'text-left h-auto min-h-10', inputValue && 'pr-8')}
                            aria-label={placeholderText}
                        >
                            <span className={cn('truncate', isShaking && 'animate-shake text-destructive')}>
                                {isAnyMutationPending ? 'Loading...' : (inputValue || placeholderText)}
                            </span>
                            <span className='ml-2 flex-shrink-0'>
                                {(isLoading || isAnyMutationPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                                {!isLoading && !isAnyMutationPending && !inputValue && (
                                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    {!isLoading && !isAnyMutationPending && inputValue && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="absolute right-2 rounded-sm p-0.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Clear search</span>
                        </button>
                    )}
                </div>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                    <Command ref={commandRef} shouldFilter={false} className='max-h-[400px]'>
                        <CommandInput
                            ref={inputRef}
                            placeholder={placeholderText}
                            className="h-9"
                            value={search}
                            onValueChange={setSearch}
                            onKeyDown={handleKeyDown}
                            aria-label="Search input"
                        />
                        <CommandList>
                            {config.length > 1 && (
                                <>
                                    <CommandGroup heading="Filter by Data Source">
                                        <CommandItem
                                            key="hidden-enter-trigger"
                                            value="##hidden-enter-trigger"
                                            onSelect={() => executeCollectionSearch(search, config)}
                                            className="hidden"
                                            aria-hidden="true"
                                        />
                                        {config.map((sourceConfigWrapper, idx) => (
                                            <CommandItem
                                                key={`source-${idx}`}
                                                value={`##source-${idx}`}
                                                onSelect={() => handleSourceFilterSelect(idx)}
                                                className="cursor-pointer"
                                            >
                                                {getSourceDisplayName(sourceConfigWrapper)}
                                                <Check className={cn('ml-auto h-4 w-4', activeSourceIndex === idx ? 'opacity-100' : 'opacity-0')} />
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    <CommandSeparator />
                                </>
                            )}

                            {queryResults.map((sourceResult, sourceIndex) => {
                                if (activeSourceIndex !== null && activeSourceIndex !== sourceIndex) return null;

                                const source = config[sourceIndex];
                                const isSearchLongEnough = debouncedSearch.trim().length >= 2;

                                if (sourceResult.isLoading && isSearchLongEnough) {
                                    return (
                                        <CommandItem key={`loading-${sourceIndex}`} disabled className="opacity-50 italic">
                                            Loading {getSourceDisplayName(source)}...
                                        </CommandItem>
                                    );
                                }

                                if (sourceResult.isError) {
                                    return (
                                        <CommandItem key={`error-fetch-${sourceIndex}`} disabled className="text-destructive">
                                            Error loading {getSourceDisplayName(source)}.
                                        </CommandItem>
                                    );
                                }

                                const hasData = resultHasData(sourceResult);

                                if (isSearchLongEnough && !sourceResult.isLoading && !hasData) {
                                    return <CommandEmpty key={`empty-${sourceIndex}`}>No results found for &quot;{debouncedSearch}&quot; in {getSourceDisplayName(source)}.</CommandEmpty>;
                                }

                                if (!hasData) return null;

                                // Masquerade results
                                if (sourceResult.type === 'masquerade' && Array.isArray(sourceResult.data)) {
                                    return (
                                        <CommandGroup key={sourceIndex} heading={getSourceDisplayName(source)}>
                                            {sourceResult.data.map((suggestion, sugIndex) => (
                                                <CommandItem
                                                    key={`${suggestion.magicKey}-${sugIndex}`}
                                                    value={suggestion.text}
                                                    onSelect={(currentValue) => handleResultSelect(currentValue, sourceIndex, suggestion, config)}
                                                    className="cursor-pointer"
                                                >
                                                    <span className='text-wrap'>{formatAddressCase(suggestion.text)}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    );
                                }

                                // PostgREST results
                                if (sourceResult.type === 'postgREST' && sourceResult.data && 'features' in sourceResult.data) {
                                    const features = sourceResult.data.features;
                                    const postgRESTSource = source as PostgRESTConfig;

                                    const renderFeatureItems = (items: typeof features) =>
                                        items.map((feature, featureIndex) => {
                                            const displayValue = getDisplayValue(feature.properties, source);
                                            if (!displayValue) return null;
                                            return (
                                                <CommandItem
                                                    key={feature.id ?? `${displayValue}-${featureIndex}-${sourceIndex}`}
                                                    value={displayValue}
                                                    onSelect={(currentValue) => handleResultSelect(currentValue, sourceIndex, feature, config)}
                                                    className="cursor-pointer"
                                                >
                                                    <span className="text-wrap">{displayValue}</span>
                                                </CommandItem>
                                            );
                                        });

                                    if (postgRESTSource.groupByField) {
                                        const groups = new Map<string, typeof features>();
                                        for (const feature of features) {
                                            const groupKey = String(feature.properties?.[postgRESTSource.groupByField] ?? 'other');
                                            const existing = groups.get(groupKey);
                                            if (existing) existing.push(feature);
                                            else groups.set(groupKey, [feature]);
                                        }

                                        return Array.from(groups.entries()).map(([groupKey, groupFeatures]) => (
                                            <CommandGroup
                                                key={`${sourceIndex}-${groupKey}`}
                                                heading={postgRESTSource.groupLabels?.[groupKey] ?? groupKey}
                                            >
                                                {renderFeatureItems(groupFeatures)}
                                            </CommandGroup>
                                        ));
                                    }

                                    return (
                                        <CommandGroup key={sourceIndex} heading={getSourceDisplayName(source)}>
                                            {renderFeatureItems(features)}
                                        </CommandGroup>
                                    );
                                }

                                return null;
                            })}

                            {!isLoading && debouncedSearch.trim().length > 1 && queryResults.every(r =>
                                !r.isLoading && !resultHasData(r)
                            ) && (
                                <CommandEmpty>No results found for &quot;{debouncedSearch}&quot;.</CommandEmpty>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
        </Popover>
    );
});

export { SearchCombobox };
