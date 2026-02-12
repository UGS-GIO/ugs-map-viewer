import { useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useQueries, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty, CommandSeparator } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
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
import { highlightFeature, highlightFeatureCollection, clearGraphics, type HighlightOptions } from '@/lib/map/highlight-utils';
import { useToast } from "@/hooks/use-toast";
import { findLayerByTitle } from '@/lib/map/utils';
import { ExtendedFeature } from '@/components/maps/popups/types';

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
    /** Extra parameters passed to the PostgREST function (e.g. { search_scale: 'small' }) */
    functionParams?: Record<string, string>;
    searchTerm?: string;
    placeholder?: string;
    groupByField?: string;
    groupLabels?: Record<string, string>;
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
interface QueryResultWrapper {
    data: QueryData | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    type: SearchSourceConfig['type'];
}


interface SearchComboboxProps {
    config: SearchSourceConfig[];
    // Called when a feature (or multi-geometry collection) is selected
    onFeatureSelect?: (searchResult: Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string, sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void
    // Called when Enter is pressed to select all results
    onCollectionSelect?: (collection: FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string | null, _sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void;
    className?: string;
}

export interface SearchComboboxHandle {
    clear: () => void;
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

function appendFunctionParams(params: URLSearchParams, source: PostgRESTConfig): void {
    if (source.functionParams) {
        for (const [key, val] of Object.entries(source.functionParams)) {
            params.set(key, val);
        }
    }
}

function resultHasData(result: QueryResultWrapper): boolean {
    if (!result.data) return false;
    if (result.type === 'masquerade') return Array.isArray(result.data) && result.data.length > 0;
    if (result.type === 'postgREST') return 'features' in result.data && result.data.features.length > 0;
    return false;
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

const SearchCombobox = forwardRef<SearchComboboxHandle, SearchComboboxProps>(function SearchCombobox({
    config,
    onFeatureSelect,
    onCollectionSelect,
    className,
}, ref) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(''); // value shown in the combobox input/button
    const [search, setSearch] = useState(''); // internal search term driving debounced queries
    const [debouncedSearch] = useDebounce(search, 500);
    const [activeSourceIndex, setActiveSourceIndex] = useState<number | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const { map } = useMap()
    const commandRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Mutation for fetching geometries from a PostgREST function
    const geometryMutation = useMutation({
        mutationFn: async ({ searchParams, sourceConfig }: { searchParams: Record<string, string>; sourceConfig: PostgRESTConfig }) => {
            const params = new URLSearchParams(searchParams);
            appendFunctionParams(params, sourceConfig);
            const url = `${sourceConfig.url}/rpc/${sourceConfig.functionName}?${params.toString()}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { ...sourceConfig.headers, 'Accept': 'application/geo+json' },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch geometries: ${response.status}`);
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
    const isAnyMutationPending = geometryMutation.isPending ||
        addressCandidateMutation.isPending;

    const ensureLayerVisibleByTitle = useCallback((layerTitle: string | undefined) => {
        if (!map || !layerTitle) return;
        const foundLayer = findLayerByTitle(map, layerTitle);
        if (foundLayer) foundLayer.visible = true;
    }, [map]);

    const clearSearch = useCallback(() => {
        setInputValue('');
        setSearch('');
        setActiveSourceIndex(null);
        setOpen(false);
        if (map) clearGraphics(map);
    }, [map]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        clearSearch();
    }, [clearSearch]);

    useImperativeHandle(ref, () => ({ clear: clearSearch }), [clearSearch]);

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
                        appendFunctionParams(urlParams, source);
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
                debouncedSearch.trim().length >= 2 &&
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

            let result: Feature<Geometry, GeoJsonProperties> | FeatureCollection<Geometry, GeoJsonProperties> | null = itemData;

            // If geometry is missing, fetch it using mutation
            if (!itemData.geometry && sourceConfig.functionName) {
                const concatnames = itemData.properties?.[sourceConfig.displayField];
                if (concatnames) {
                    try {
                        const data = await geometryMutation.mutateAsync({
                            searchParams: { search_key: concatnames },
                            sourceConfig,
                        });
                        let features: Feature<Geometry, GeoJsonProperties>[] = [];
                        if (data?.type === 'FeatureCollection' && data.features?.length > 0) {
                            features = data.features;
                        } else if (Array.isArray(data) && data.length > 0 && data[0]?.type === 'Feature') {
                            features = data;
                        }
                        if (features.length === 1) {
                            result = features[0];
                        } else if (features.length > 1) {
                            result = featureCollection(features);
                        }
                    } catch (error) {
                        console.error("Error fetching feature geometry:", error);
                    }
                }
            }

            onFeatureSelect?.(result, sourceConfig.url, sourceIndex, searchConfig, map);
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
                executeCollectionSearch(search, config);
            }
        }
    };


    const executeCollectionSearch = async (currentSearchTerm: string, searchConfig: SearchSourceConfig[]) => {
        // If queries are still loading, show toast and let user wait for dropdown results
        if (isLoading && currentSearchTerm.trim().length > 3) {
            toast({
                variant: "default",
                description: "Loading results... Press Enter again when ready.",
                duration: 2000,
            });
            return;
        }

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
                    const data = await geometryMutation.mutateAsync({
                        searchParams: { [sourceConfig.searchTerm!]: `%${currentSearchTerm}%` },
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

        let combinedCollection: FeatureCollection | null = null;
        if (allVisibleFeatures.length > 0) {
            combinedCollection = featureCollection(allVisibleFeatures);
        }

        // Call the actual select handler provided by the parent component
        if (map) {
            onCollectionSelect?.(combinedCollection, firstValidSourceUrl, firstValidSourceIndex, searchConfig, map);
        }

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

    return (
        <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        data-tour="search-box"
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
                            {!isLoading && !isAnyMutationPending && inputValue && (
                                <X className="h-4 w-4 opacity-50 hover:opacity-100" onClick={handleClear} />
                            )}
                            {!isLoading && !isAnyMutationPending && !inputValue && (
                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            )}
                        </span>
                    </Button>
                </PopoverTrigger>
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
                                const isSearchLongEnough = debouncedSearch.trim().length >= 2;
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

                                const hasData = resultHasData(sourceResult);

                                // Empty State
                                if (isSearchLongEnough && !sourceResult.isLoading && !hasData) {
                                    return <CommandEmpty key={`empty-${sourceIndex}`}>No results found for "{debouncedSearch}" in {getSourceDisplayName(source)}.</CommandEmpty>;
                                }

                                // return null for no data
                                if (!hasData) {
                                    return null;
                                }

                                // Masquerade results — single group
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
                                        });

                                    // Grouped rendering when groupByField is configured
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

                                    // Default flat rendering
                                    return (
                                        <CommandGroup key={sourceIndex} heading={getSourceDisplayName(source)}>
                                            {renderFeatureItems(features)}
                                        </CommandGroup>
                                    );
                                }

                                return null;
                            })}

                            {/* Empty State Check */}
                            {!isLoading && debouncedSearch.trim().length > 1 && queryResults.every(r =>
                                !r.isLoading && !resultHasData(r)
                            ) && (
                                    <CommandEmpty>No results found for "{debouncedSearch}".</CommandEmpty>
                                )}
                        </CommandList>
                    </Command>
                </PopoverContent>
        </Popover>
    );
});

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

// Shared highlight + zoom logic
function highlightAndZoom(
    features: Feature<ExtendedGeometry, GeoJsonProperties>[],
    sourceConfig: SearchSourceConfig,
    map: MapLibreMap,
    title: string,
    options?: HighlightOptions,
) {
    if (!features.length) return;
    const sourceCRS = determineCRS(features[0], sourceConfig);

    if (features.length === 1) {
        const feat = features[0];
        const featureToHighlight: ExtendedFeature = {
            type: 'Feature',
            geometry: feat.geometry,
            properties: feat.properties || {},
            namespace: (feat as ExtendedFeature)?.namespace || '',
        };
        highlightFeature(featureToHighlight, map, sourceCRS, title, options);
    } else {
        highlightFeatureCollection(features, map, sourceCRS, title, options);
    }

    const geojson = features.length === 1 ? features[0].geometry : featureCollection(features);
    const resultBbox = bbox(geojson);
    if (!resultBbox.every(isFinite)) return;

    const [xmin, ymin, xmax, ymax] = convertBbox(resultBbox, sourceCRS, "EPSG:4326");
    const isPoint = features.length === 1 && features[0].geometry.type === 'Point';
    zoomToExtent(xmin, ymin, xmax, ymax, map, isPoint ? 13000 : undefined);
}

// Handler for single feature selection (also handles multi-feature results from search)
const handleSearchSelect = (
    result: Feature<ExtendedGeometry, GeoJsonProperties> | FeatureCollection<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    const sourceConfig = searchConfig[sourceIndex];
    if (!map || !sourceConfig || !result) return;

    clearGraphics(map);
    const features = result.type === 'FeatureCollection' ? result.features : [result];
    highlightAndZoom(features, sourceConfig, map, 'Search Box Highlight');
};

// Handler for collection selection (Enter key)
const handleCollectionSelect = (
    collection: FeatureCollection<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string | null,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    if (!collection?.features?.length || !map) return;

    clearGraphics(map);
    highlightAndZoom(
        collection.features,
        searchConfig[sourceIndex],
        map,
        'Search Box Collection Highlight',
        { outlineWidth: 6, pointSize: 16, outlineColor: [255, 255, 0, 1] },
    );
};

export { SearchCombobox, handleSearchSelect, handleCollectionSelect };