import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useQueries, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandSeparator } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureCollection, Geometry, GeoJsonProperties, Feature } from 'geojson';
import { featureCollection, point as turfPoint } from '@turf/helpers';
import { bbox } from "@turf/bbox";
import type { MapLibreMap } from '@/lib/types/map-types';
import { useDebounce } from 'use-debounce';
import { MASQUERADE_GEOCODER_URL } from '@/lib/constants';
import { useMap } from '@/hooks/use-map';
import { convertBbox } from '@/lib/map/conversion-utils';
import { zoomToExtent } from '@/lib/sidebar/filter/util';
import { highlightFeature, highlightFeatureCollection, clearGraphics } from '@/lib/map/highlight-utils';
import { useToast } from "@/hooks/use-toast";
import { findLayerByTitle } from '@/lib/map/utils';
import { ExtendedFeature } from '@/components/custom/popups/popup-content-with-pagination';

export const defaultMasqueradeConfig: SearchSourceConfig = {
    type: 'masquerade',
    url: MASQUERADE_GEOCODER_URL,
    sourceName: 'Address Search',
    displayField: 'text',
    outSR: 4326 // Request WGS84
}

interface BaseConfig {
    url: string;
    sourceName?: string; // Optional descriptive name
    headers?: Record<string, string>;
    displayField: string;
}

interface PostgRESTConfig extends BaseConfig {
    type: 'postgREST';
    layerName?: string; // corresponds to the map layer name
    crs?: string; // Optional: if provided, it will be used to convert coordinates to WGS84
    params?: PostgRESTParams;
    functionName?: string;
    searchTerm?: string;
    placeholder?: string;
}

type PostgRESTParams =
    | { targetField: string; select?: string } // Search specific field
    | { select: string; targetField?: never } // Select specific columns only
    | { searchKeyParam: string, targetField?: never, select?: never }; // Function param name (less common now?)

export interface MasqueradeConfig extends BaseConfig {
    type: 'masquerade';
    maxSuggestions?: number;
    outSR?: number; // e.g., 4326
    placeholder?: string;
    // displayField will be 'text' for suggestions, 'address' for candidates
}

export type SearchSourceConfig = PostgRESTConfig | MasqueradeConfig;
export type ExtendedGeometry = Geometry & { crs?: { properties: { name: string; }; type: string; }; };

// Masquerade Suggestion
interface Suggestion {
    text: string;
    magicKey: string;
    isCollection?: boolean;
}

type QueryData = Suggestion[] | FeatureCollection<Geometry, GeoJsonProperties>;
// QueryResult type
interface QueryResultWrapper<TData = QueryData> {
    data: TData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    type: SearchSourceConfig['type']; // Add type here
}


interface SearchComboboxProps {
    config: SearchSourceConfig[];
    // Called when a feature is selected (PostgREST or resolved Masquerade address)
    onFeatureSelect?: (searchResult: Feature<Geometry, GeoJsonProperties> | null, _sourceUrl: string, sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void
    // Called when Enter is pressed to select all results
    onCollectionSelect?: (collection: FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string | null, _sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void;
    className?: string;
}

// Pure helper functions (outside component to avoid recreation)
function formatAddressCase(address: string | undefined | null): string {
    if (!address) return '';
    return address.toLowerCase().split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
        .join(' ');
}

function formatName(name: string): string {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
        .join(' ')
        .replace(/^Rpc\s/, '')
        .trim();
}

function getSourceDisplayName(sourceConfig: SearchSourceConfig): string {
    if (sourceConfig.sourceName) return sourceConfig.sourceName;
    let name = '';
    if (sourceConfig.type === 'postgREST') {
        if (sourceConfig.functionName) name = sourceConfig.functionName;
        else if (sourceConfig.params && 'targetField' in sourceConfig.params && sourceConfig.params.targetField) {
            name = sourceConfig.params.targetField;
        } else {
            name = sourceConfig.url.split('/').pop() || '';
        }
    } else if (sourceConfig.type === 'masquerade') {
        name = "Address Search: e.g. 123 Main St";
    }
    return formatName(name || sourceConfig.url.split('/').pop() || 'Unknown Source');
}

function SearchCombobox({
    config,
    onFeatureSelect,
    onCollectionSelect,
    className,
}: SearchComboboxProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(''); // value shown in the combobox input/button
    const [search, setSearch] = useState(''); // internal search term driving debounced queries
    const [debouncedSearch] = useDebounce(search, 500);
    const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const { map } = useMap()
    const commandRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const pendingSearchRef = useRef<{ searchTerm: string; config: SearchSourceConfig[] } | null>(null);

    // Mutation for fetching collection geometries (Enter key)
    const collectionGeometryMutation = useMutation({
        mutationFn: async ({ searchTerm, sourceConfig }: { searchTerm: string; sourceConfig: PostgRESTConfig }) => {
            const url = `${sourceConfig.url}/rpc/${sourceConfig.functionName}?${sourceConfig.searchTerm}=${encodeURIComponent(`%${searchTerm}%`)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...sourceConfig.headers,
                    'Accept': 'application/geo+json',
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch geometries: ${response.status}`);
            }
            return response.json();
        },
    });

    // Mutation for fetching single feature geometry
    const singleGeometryMutation = useMutation({
        mutationFn: async ({ concatnames, sourceConfig }: { concatnames: string; sourceConfig: PostgRESTConfig }) => {
            const url = `${sourceConfig.url}/rpc/${sourceConfig.functionName}?search_key=${encodeURIComponent(concatnames)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    ...sourceConfig.headers,
                    'Accept': 'application/geo+json',
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch geometry: ${response.status}`);
            }
            return response.json();
        },
    });

    // Mutation for fetching Masquerade address candidates
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

            if (!response.ok) {
                throw new Error(`findAddressCandidates failed: ${response.status}`);
            }
            return response.json();
        },
    });

    // Combined loading state for all async operations
    const isAnyMutationPending = collectionGeometryMutation.isPending ||
        singleGeometryMutation.isPending ||
        addressCandidateMutation.isPending;

    const ensureLayerVisibleByTitle = useCallback((layerTitle: string | undefined) => {
        if (!map || !layerTitle) return;
        const foundLayer = findLayerByTitle(map, layerTitle);
        if (foundLayer) foundLayer.visible = true;
    }, [map]);

    const placeholderText = useMemo(() => {
        if (activeSourceIndex !== null && config[activeSourceIndex]) {
            return `Search in ${getSourceDisplayName(config[activeSourceIndex])}...`;
        }
        return config[0]?.placeholder || `Search...`;
    }, [activeSourceIndex, config]);

    const queries = useQueries({
        queries: config.map((source, index) => ({
            queryKey: queryKeys.sidebar.search(source.url, source.type, debouncedSearch, index),
            queryFn: async (): Promise<QueryData> => {
                if (source.type === 'masquerade') {

                    const params = new URLSearchParams();
                    params.set('text', debouncedSearch.trim());
                    params.set('maxSuggestions', (source.maxSuggestions ?? 6).toString());
                    const wkid = source.outSR ?? 4326;
                    params.set('outSR', JSON.stringify({ wkid }));
                    params.set('f', 'json');

                    const suggestUrl = `${source.url}/suggest?${params.toString()}`;
                    const response = await fetch(suggestUrl, { method: 'GET', headers: source.headers });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Suggest API Error (${response.status}) from ${suggestUrl}: ${errorText}`);
                        throw new Error(`Suggest Network response was not ok (${response.status})`);
                    }
                    const data = await response.json();
                    const suggestions = (data?.suggestions || []) as Suggestion[];

                    // Filter based on magicKey and only include address points
                    const addressPointSuggestions = suggestions.filter(s =>
                        s.magicKey?.includes('opensgid.location.address_points')
                    );

                    return addressPointSuggestions; // Type: Suggestion[]

                } else if (source.type === 'postgREST') {
                    // Fetch logic for PostgREST
                    const params = source.params;
                    const urlParams = new URLSearchParams();
                    let apiUrl = '';
                    const headers: HeadersInit = source.headers || {};

                    if (source.functionName) {
                        // PostgREST Function Call
                        const functionUrl = `${source.url}/rpc/${source.functionName}`;
                        const searchTermValue = debouncedSearch ? `%${debouncedSearch}%` : '';
                        const searchTermParamName = source.searchTerm;
                        if (!searchTermParamName) throw new Error(`Missing searchTerm parameter config for function ${source.functionName}`);
                        urlParams.set(searchTermParamName, searchTermValue);

                        if (params && 'select' in params && params.select) {
                            urlParams.set('select', params.select);
                        }
                        apiUrl = `${functionUrl}?${urlParams.toString()}`;
                    } else {
                        // PostgREST Table/View Query
                        apiUrl = `${source.url}`;
                        const searchTermValue = debouncedSearch ? `%${debouncedSearch}%` : '';

                        if (params && 'targetField' in params && params.targetField && searchTermValue) {
                            urlParams.set(params.targetField, `ilike.${searchTermValue}`);
                        }

                        if (params && 'select' in params && params.select) {
                            urlParams.set('select', params.select);
                        } else { // Default select
                            urlParams.set('select', `*,geometry`);
                            if (!params || (params && !('select' in params))) {
                                console.warn(`Source ${index} ('${source.url}'): Defaulting select to '*,geometry'.`);
                            }
                        }
                        urlParams.set('limit', '100');
                        apiUrl = `${apiUrl}?${urlParams.toString()}`;
                    }

                    // Fetch and Process
                    const response = await fetch(apiUrl, { method: 'GET', headers });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API Error (${response.status}) from ${apiUrl}: ${errorText}`);
                        throw new Error(`Network response was not ok (${response.status})`);
                    }
                    const data = await response.json();

                    // Handle different valid responses
                    if (data && Array.isArray(data)) {
                        // Check if it's already GeoJSON Features
                        if (data.length === 0 || (data[0]?.type === 'Feature')) {
                            return featureCollection(data as Feature<Geometry, GeoJsonProperties>[]);
                        }
                        // Plain objects from select query (no geometry) - convert to pseudo-features for display
                        const pseudoFeatures: Feature<Geometry, GeoJsonProperties>[] = data.map((item, idx) => ({
                            type: 'Feature' as const,
                            id: idx,
                            geometry: null as unknown as Geometry, // No geometry - will be fetched on selection
                            properties: item
                        }));
                        return featureCollection(pseudoFeatures);
                    } else if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
                        return data as FeatureCollection<Geometry, GeoJsonProperties>;
                    } else {
                        console.warn(`API response from ${apiUrl} was not valid GeoJSON Feature array or FeatureCollection.`, data);
                        return featureCollection([]);
                    }
                } else {
                    throw new Error(`Unsupported source type`);
                }
            },

            enabled: (
                !!debouncedSearch &&
                debouncedSearch.trim().length > 3 &&
                (activeSourceIndex === null || activeSourceIndex === index)
            ),
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 300000, // 5 minutes
            gcTime: 600000, // 10 minutes
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

    const handleSourceFilterSelect = (sourceIndex: number) => {
        setActiveSourceIndex(sourceIndex === activeSourceIndex ? null : sourceIndex);
        setInputValue('');
        setSearch('');
    };

    const handleResultSelect = async (
        value: string,
        sourceIndex: number,
        itemData: Feature<Geometry, GeoJsonProperties> | Suggestion,
        searchConfig: SearchSourceConfig[]
    ) => {
        if (!map) {
            console.error('[SearchCombobox] Map is null - cannot process selection');
            return;
        }

        const sourceConfig = config[sourceIndex];

        // Handle Masquerade suggestion - fetch address candidate using mutation
        if (sourceConfig.type === 'masquerade' && 'magicKey' in itemData) {
            setInputValue(formatAddressCase(itemData.text));

            try {
                const data = await addressCandidateMutation.mutateAsync({
                    magicKey: itemData.magicKey,
                    sourceConfig
                });

                if (data?.candidates?.length > 0) {
                    const bestCandidate = data.candidates[0];
                    const pointGeom = turfPoint([bestCandidate.location.x, bestCandidate.location.y]).geometry;
                    const feature: Feature<Geometry, GeoJsonProperties> = {
                        type: "Feature",
                        geometry: pointGeom,
                        properties: {
                            ...bestCandidate.attributes,
                            matchAddress: bestCandidate.address,
                            score: bestCandidate.score,
                            [sourceConfig.displayField || 'address']: bestCandidate.address
                        }
                    };
                    // Call the feature select handler with the resolved feature
                    onFeatureSelect?.(feature, sourceConfig.url, sourceIndex, searchConfig, map);
                }
            } catch (error) {
                console.error("Error fetching address candidates:", error);
            }
            return;
        }

        // Handle PostgREST feature selection
        if (sourceConfig.type === 'postgREST' && 'type' in itemData && itemData.type === 'Feature') {
            const displayValue = String(itemData.properties?.[sourceConfig.displayField] ?? '');
            setInputValue(displayValue || value);

            ensureLayerVisibleByTitle(sourceConfig.layerName);

            let featureWithGeom: Feature<Geometry, GeoJsonProperties> | null = itemData;

            // If geometry is missing, fetch it using mutation
            if (!itemData.geometry && sourceConfig.functionName) {
                const concatnames = itemData.properties?.[sourceConfig.displayField];
                if (concatnames) {
                    try {
                        const data = await singleGeometryMutation.mutateAsync({
                            concatnames,
                            sourceConfig
                        });
                        if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
                            featureWithGeom = data.features[0];
                        } else if (Array.isArray(data) && data.length > 0 && data[0]?.type === 'Feature') {
                            featureWithGeom = data[0];
                        }
                    } catch (error) {
                        console.error("Error fetching feature geometry:", error);
                    }
                }
            }

            onFeatureSelect?.(featureWithGeom, sourceConfig.url, sourceIndex, searchConfig, map);
        } else {
            console.error("Mismatched item data type or config type in handleResultSelect", itemData, sourceConfig);
            setInputValue(value);
        }

        setOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            // Find the currently highlighted item, if any
            const selectedItem = commandRef.current?.querySelector('[role="option"][data-selected="true"]');

            // Check if the selected item is one of the source filters
            const isSourceFilterSelected = selectedItem?.getAttribute('value')?.startsWith('##source-');

            // If nothing is selected OR a source filter is selected,
            // prevent default selection/submission and run the collection search.
            if (!selectedItem || isSourceFilterSelected) {
                event.preventDefault(); // Prevent cmdk from acting on Enter

                // If queries are still loading, store pending search and wait
                if (isLoading && search.trim().length > 3) {
                    pendingSearchRef.current = { searchTerm: search, config };
                    toast({
                        variant: "default",
                        description: "Waiting for search results...",
                        duration: 2000,
                    });
                    return;
                }

                executeCollectionSearch(search, config);
            }
        }
    };


    const executeCollectionSearch = async (currentSearchTerm: string, searchConfig: SearchSourceConfig[]) => {
        let allVisibleFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
        let firstValidSourceUrl: string | null = null;
        let firstValidSourceIndex: number = -1;
        let needsGeometryFetch = false;
        const indicesToCheck = activeSourceIndex !== null ? [activeSourceIndex] : config.map((_, index) => index);

        indicesToCheck.forEach(index => {
            const sourceResult = queryResults[index];
            // Ensure we only try to access properties if sourceResult and its data exist and match PostgREST type
            if (sourceResult?.data && sourceResult.type === 'postgREST' && 'features' in sourceResult.data && Array.isArray(sourceResult.data.features)) {
                const sourceConfig = config[index];
                // Ensure config exists and is PostgREST type (safety check)
                if (sourceConfig?.type === 'postgREST' && sourceResult.data.features.length > 0) {
                    allVisibleFeatures = allVisibleFeatures.concat(sourceResult.data.features);
                    if (firstValidSourceIndex === -1) {
                        firstValidSourceUrl = sourceConfig.url;
                        firstValidSourceIndex = index;
                    }
                    // Check if features are missing geometry (due to select optimization)
                    if (!sourceResult.data.features[0]?.geometry) {
                        needsGeometryFetch = true;
                    }

                    ensureLayerVisibleByTitle(sourceConfig.layerName);
                }
            }
        });

        // If features don't have geometry, fetch with geometry for highlighting
        if (needsGeometryFetch && allVisibleFeatures.length > 0 && firstValidSourceIndex !== -1) {
            const sourceConfig = searchConfig[firstValidSourceIndex] as PostgRESTConfig;
            if (sourceConfig.functionName && sourceConfig.searchTerm) {
                try {
                    const data = await collectionGeometryMutation.mutateAsync({
                        searchTerm: currentSearchTerm,
                        sourceConfig
                    });
                    if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
                        allVisibleFeatures = data.features;
                    }
                } catch (error) {
                    console.error('Error fetching geometries for collection:', error);
                }
            }
        }

        let combinedCollection: FeatureCollection | null = null;
        if (allVisibleFeatures.length > 0) {
            combinedCollection = featureCollection(allVisibleFeatures);
        }

        // Call the actual select handler provided by the parent component
        onCollectionSelect?.(combinedCollection, firstValidSourceUrl, firstValidSourceIndex, searchConfig, map);

        if (combinedCollection !== null) {
            setOpen(false);
            setInputValue(`Results for "${currentSearchTerm}"`);
        } else {
            // If no features were collected for this action, shake the input
            const errorMessage = `${currentSearchTerm === '' ? 'Please enter a search term' : `No results for "${currentSearchTerm}. If searching for an address, please select a suggestion.`}`;
            const shakingDuration = 650;
            setIsShaking(true);
            toast({
                variant: "destructive",
                title: "Search Failed",
                description: errorMessage,
                duration: shakingDuration * 3,
            });
            setInputValue('');
            setTimeout(() => {
                setIsShaking(false);
            }, shakingDuration);
        }

    }

    const isLoading = queryResults.some(result => result.isLoading);

    // Execute pending search when loading completes
    useEffect(() => {
        if (!isLoading && pendingSearchRef.current) {
            const pending = pendingSearchRef.current;
            pendingSearchRef.current = null;
            executeCollectionSearch(pending.searchTerm, pending.config);
        }
    }, [isLoading]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(className,
                            'w-full',
                            'justify-between',
                            'text-left h-auto min-h-10',
                        )}
                        aria-label={placeholderText}
                    >
                        <span
                            className={cn(
                                'truncate',
                                isShaking && 'animate-shake text-destructive'
                            )}
                        >
                            {isAnyMutationPending ? 'Loading...' : (inputValue || placeholderText)}
                        </span>
                        <span className='ml-2 flex-shrink-0'>
                            {(isLoading || isAnyMutationPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                            {!isLoading && !isAnyMutationPending && <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                    <Command ref={commandRef} shouldFilter={false} className='max-h-[400px]'>
                        <CommandInput
                            placeholder={placeholderText}
                            className="h-9"
                            value={search}
                            onValueChange={setSearch}
                            onKeyDown={handleKeyDown}
                            aria-label="Search input"
                        />
                        <CommandList>
                            {/* Data Sources Filter */}
                            {config.length > 1 && ( // Only show source filter if more than one source
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

                            {/* Results Area */}
                            {queryResults.map((sourceResult, sourceIndex) => {
                                // Skip rendering if a filter is active and it's not the active source
                                if (activeSourceIndex !== null && activeSourceIndex !== sourceIndex) return null;

                                const source = config[sourceIndex];

                                // Loading State: check if query is loading AND search term is valid length
                                const isSearchLongEnough = debouncedSearch.trim().length > 3;
                                if (sourceResult.isLoading && isSearchLongEnough) {
                                    return (
                                        <CommandItem key={`loading-${sourceIndex}`} disabled className="opacity-50 italic">
                                            Loading {getSourceDisplayName(source)}...
                                        </CommandItem>
                                    );
                                }

                                // Error State
                                if (sourceResult.isError) {
                                    return (
                                        <CommandItem key={`error-fetch-${sourceIndex}`} disabled className="text-destructive">
                                            Error loading {getSourceDisplayName(source)}.
                                        </CommandItem>
                                    );
                                }

                                const hasData = sourceResult.data &&
                                    ((sourceResult.type === 'masquerade' && Array.isArray(sourceResult.data) && sourceResult.data.length > 0) ||
                                        (sourceResult.type === 'postgREST' && 'features' in sourceResult.data && sourceResult.data.features.length > 0));

                                // Empty State
                                if (isSearchLongEnough && !sourceResult.isLoading && !hasData) {
                                    return <CommandEmpty key={`empty-${sourceIndex}`}>No results found for "{debouncedSearch}" in {getSourceDisplayName(source)}.</CommandEmpty>;
                                }

                                // return null for no data
                                if (!hasData) {
                                    return null;
                                }

                                return (
                                    <CommandGroup key={sourceIndex} heading={getSourceDisplayName(source)}>
                                        {/* Type guard for Masquerade results */}
                                        {sourceResult.type === 'masquerade' && Array.isArray(sourceResult.data) && sourceResult.data.map((suggestion, sugIndex) => {
                                            return (
                                                <CommandItem
                                                    key={`${suggestion.magicKey}-${sugIndex}`}
                                                    value={suggestion.text}
                                                    onSelect={(currentValue) => handleResultSelect(currentValue, sourceIndex, suggestion, config)}
                                                    className="cursor-pointer"
                                                >
                                                    <span className='text-wrap'>{formatAddressCase(suggestion.text)}</span>
                                                </CommandItem>
                                            )
                                        }
                                        )}

                                        {/* Type guard for PostgREST results */}
                                        {sourceResult.type === 'postgREST' && sourceResult.data && 'features' in sourceResult.data && sourceResult.data.features.map((feature, featureIndex) => {
                                            const displayValue = String(feature.properties?.[source.displayField] ?? '');
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
                                        })}
                                    </CommandGroup>
                                );
                            })}

                            {/* Empty State Check */}
                            {!isLoading && debouncedSearch.trim().length > 1 && queryResults.every(result => {
                                // Check if this specific source is loading or has data
                                const hasDataForSource = result.data &&
                                    ((result.type === 'masquerade' && Array.isArray(result.data) && result.data.length > 0) ||
                                        (result.type === 'postgREST' && 'features' in result.data && result.data.features.length > 0));
                                // The condition for .every is true if the source is NOT loading AND it does NOT have data
                                return !result.isLoading && !hasDataForSource;
                            }) && (
                                    <CommandEmpty>No results found for "{debouncedSearch}".</CommandEmpty>
                                )}
                        </CommandList>
                    </Command>
                </PopoverContent>
        </Popover>
    );
}

// Shared CRS determination logic
const determineCRS = (
    feature: Feature<ExtendedGeometry, GeoJsonProperties> | null,
    sourceConfig: SearchSourceConfig
): string => {
    const geom = feature?.geometry as ExtendedGeometry | undefined;
    const outputCrs = feature?.properties?.['output_crs'];

    if (sourceConfig.type === 'masquerade') return `EPSG:${sourceConfig.outSR ?? 4326}`;
    if (outputCrs && (typeof outputCrs === 'number' || typeof outputCrs === 'string')) return `EPSG:${outputCrs}`;
    if (geom?.crs?.properties?.name) {
        const match = geom.crs.properties.name.match(/EPSG::(\d+)/);
        return match?.[1] ? `EPSG:${match[1]}` : geom.crs.properties.name;
    }
    if (sourceConfig.type === 'postgREST' && sourceConfig.crs) return sourceConfig.crs;
    return "EPSG:4326";
};

// Handler for single feature selection
const handleSearchSelect = (
    feature: Feature<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    const sourceConfig = searchConfig[sourceIndex];
    const geom = feature?.geometry;

    if (!map || !sourceConfig || !geom) return;

    clearGraphics(map);
    const sourceCRS = determineCRS(feature, sourceConfig);

    const featureToHighlight: ExtendedFeature = {
        type: 'Feature',
        geometry: geom,
        properties: feature?.properties || {},
        namespace: (feature as ExtendedFeature)?.namespace || ''
    };
    highlightFeature(featureToHighlight, map, sourceCRS, 'Search Box Single Feature Highlight');

    const featureBbox = bbox(geom);
    if (!featureBbox?.every(isFinite)) return;

    const [xmin, ymin, xmax, ymax] = convertBbox(featureBbox, sourceCRS, "EPSG:4326");
    zoomToExtent(xmin, ymin, xmax, ymax, map, geom.type === "Point" ? 13000 : undefined);
};

// Handler for collection selection
const handleCollectionSelect = (
    collection: FeatureCollection<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string | null,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    if (!collection?.features?.length || !map) return;

    clearGraphics(map);
    const sourceCRS = determineCRS(collection.features[0], searchConfig[sourceIndex]);

    highlightFeatureCollection(
        collection.features,
        map,
        sourceCRS,
        'Search Box Collection Highlight',
        { outlineWidth: 6, pointSize: 16, outlineColor: [255, 255, 0, 1] }
    );

    const collectionBbox = bbox(collection);
    if (!collectionBbox.every(isFinite)) return;

    const [xmin, ymin, xmax, ymax] = convertBbox(collectionBbox, sourceCRS, "EPSG:4326");
    zoomToExtent(xmin, ymin, xmax, ymax, map);
};

export { SearchCombobox, handleSearchSelect, handleCollectionSelect };