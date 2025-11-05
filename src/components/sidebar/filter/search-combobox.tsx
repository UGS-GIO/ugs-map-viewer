import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { highlightFeature, clearGraphics } from '@/lib/map/highlight-utils';
import { Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
export interface SearchConfig { config: SearchSourceConfig; }
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
    // Called when a PostgREST feature OR a finalized Masquerade candidate is selected
    onFeatureSelect?: (searchResult: Feature<Geometry, GeoJsonProperties> | null, _sourceUrl: string, sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void
    // Called when Enter is pressed on PostgREST results
    onCollectionSelect?: (collection: FeatureCollection<Geometry, GeoJsonProperties> | null, _sourceUrl: string | null, _sourceIndex: number, searchConfig: SearchSourceConfig[], map: MapLibreMap) => void;
    // Called when a Masquerade suggestion is clicked
    onSuggestionSelect?: (suggestion: Suggestion, sourceConfig: MasqueradeConfig, sourceIndex: number, map: MapLibreMap, searchConfig: SearchSourceConfig[]) => void;
    className?: string;
}

function formatAddressCase(address: string | undefined | null): string {
    if (!address) return '';
    // Convert to lowercase, split into words, capitalize first letter of each, join back
    return address.toLowerCase().split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
        .join(' ');
}

function SearchCombobox({
    config,
    onFeatureSelect,
    onCollectionSelect,
    onSuggestionSelect,
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

    const ensureLayerVisibleByTitle = (
        layerTitle: string | undefined,
        contextMessage: string
    ) => {
        if (!map) {
            console.error(`Map is not defined. Cannot ensure layer visibility for ${contextMessage}.`);
            return;
        }
        if (!layerTitle) {
            return;
        }

        const foundLayer = findLayerByTitle(map, layerTitle);
        if (foundLayer) {
            foundLayer.visible = true;
        } else {
            console.warn(`Layer "${layerTitle}" not found in the map (context: ${contextMessage}).`);
        }
    }

    function formatName(name: string): string { // Format name for display: E.g. "api" -> "API", "address_search" -> "Address Search"
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1') // Add space before caps (might add extra space if already spaced)
            .replace(/\s+/g, ' ') // Consolidate multiple spaces
            .split(' ')
            .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
            .join(' ')
            .replace(/^Rpc\s/, '') // Remove "Rpc " prefix if present
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
                const urlParts = sourceConfig.url.split('/');
                name = urlParts[urlParts.length - 1] || ''; // Get last part of URL as fallback
            }
        } else if (sourceConfig.type === 'masquerade') {
            name = "Address Search: e.g. 123 Main St";
        }

        if (!name) { // Fallback if name is still empty
            const urlParts = sourceConfig.url.split('/');
            name = urlParts[urlParts.length - 1] || 'Unknown Source';
        }
        return formatName(name);
    }

    const getPlaceholderText = () => {
        if (activeSourceIndex !== null && config[activeSourceIndex]) {
            return `Search in ${getSourceDisplayName(config[activeSourceIndex])}...`;
        }
        return config[0]?.placeholder || `Search...`;
    };

    const queryResults: QueryResultWrapper[] = config.map((sourceConfigWrapper, index) => {
        const source = sourceConfigWrapper;
        const query = useQuery<QueryData, Error>({
            queryKey: ['search', source.url, source.type, debouncedSearch, index],
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
                    if (data && Array.isArray(data) && (data.length === 0 || (data[0]?.type === 'Feature' && data[0]?.geometry && data[0]?.properties))) {
                        return featureCollection(data as Feature<Geometry, GeoJsonProperties>[]);
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
        });

        return {
            data: query.data,
            error: query.error,
            isLoading: query.isLoading,
            isError: query.isError,
            type: source.type
        } as QueryResultWrapper;
    });

    const handleSourceFilterSelect = (sourceIndex: number) => {
        setActiveSourceIndex(sourceIndex === activeSourceIndex ? null : sourceIndex);
        setInputValue('');
        setSearch('');
    };

    const handleResultSelect = (
        value: string,
        sourceIndex: number,
        itemData: Feature<Geometry, GeoJsonProperties> | Suggestion,
        searchConfig: SearchSourceConfig[]
    ) => {
        const sourceConfig = config[sourceIndex];

        // Use type guards or property checks on itemData
        if (sourceConfig.type === 'masquerade' && 'magicKey' in itemData) { // Check if it's a Suggestion
            onSuggestionSelect?.(itemData, sourceConfig, sourceIndex, map, searchConfig);
            setInputValue(formatAddressCase(itemData.text));
        } else if (sourceConfig.type === 'postgREST' && 'type' in itemData && itemData.type === 'Feature') {
            const displayValue = String(itemData.properties?.[sourceConfig.displayField] ?? '');
            const typedConfig = searchConfig[sourceIndex] as PostgRESTConfig;
            setInputValue(displayValue || value);


            ensureLayerVisibleByTitle(typedConfig.layerName, `PostgREST feature select (source index ${sourceIndex})`);

            onFeatureSelect?.(itemData, sourceConfig.url, sourceIndex, searchConfig, map);
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


    const executeCollectionSearch = (currentSearchTerm: string, searchConfig: SearchSourceConfig[]) => {
        let allVisibleFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
        let firstValidSourceUrl: string | null = null;
        let firstValidSourceIndex: number = -1;
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

                    ensureLayerVisibleByTitle(sourceConfig.layerName, `PostgREST collection search (source index ${index})`);
                }
            }
        });

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
        };

    }

    const isLoading = queryResults.some(result => result.isLoading);

    return (
        <TooltipProvider>
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
                        aria-label={getPlaceholderText()}
                    >
                        <Tooltip
                            delayDuration={300}
                        >
                            <TooltipTrigger asChild>
                                <span
                                    className={cn(
                                        'truncate',
                                        isShaking && 'animate-shake text-destructive'
                                    )}
                                >
                                    {inputValue || getPlaceholderText()}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side='bottom' className="z-60 max-w-[--radix-popover-trigger-width] bg-secondary text-base text-secondary-foreground">
                                <p>{inputValue || getPlaceholderText()}</p>
                                <TooltipArrow className="fill-secondary" />
                            </TooltipContent>
                        </Tooltip>
                        <span className='ml-2 flex-shrink-0'>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {!isLoading && <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                        </span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="end">
                    <Command ref={commandRef} shouldFilter={false} className='max-h-[400px]'>
                        <CommandInput
                            placeholder={getPlaceholderText()}
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
        </TooltipProvider>
    );
}

// Handler for Masquerade Suggestion Selection
const handleSuggestionSelect = async (
    suggestion: Suggestion,
    sourceConfig: SearchSourceConfig,
    sourceIndex: number,
    map: MapLibreMap,
    searchConfig: SearchSourceConfig[],
) => {

    if (sourceConfig.type !== 'masquerade' || !map) {
        return;
    }

    clearGraphics(map);

    // findAddressCandidates
    try {
        const params = new URLSearchParams();
        params.set('magicKey', suggestion.magicKey);
        params.set('outFields', '*');
        params.set('maxLocations', '1');
        params.set('outSR', JSON.stringify({ wkid: sourceConfig.outSR ?? 4326 }));
        params.set('f', 'json');

        const candidatesUrl = `${sourceConfig.url}/findAddressCandidates?${params.toString()}`;
        const response = await fetch(candidatesUrl, { method: 'GET', headers: sourceConfig.headers });

        if (!response.ok) {
            throw new Error(`findAddressCandidates failed: ${response.status}`);
        }

        const data = await response.json();

        if (data?.candidates?.length > 0) {
            const bestCandidate = data.candidates[0];

            // Format Candidate into GeoJSON Feature
            const pointGeom = turfPoint([bestCandidate.location.x, bestCandidate.location.y]).geometry;
            const feature: Feature<Geometry, GeoJsonProperties> = {
                type: "Feature",
                geometry: pointGeom,
                properties: {
                    ...bestCandidate.attributes, // Include attributes from geocoder
                    matchAddress: bestCandidate.address, // Add matched address
                    score: bestCandidate.score,
                    // Use the specific displayField requested by the source if needed,
                    // otherwise default to address for display consistency post-selection
                    [sourceConfig.displayField || 'address']: bestCandidate.address
                }
            };

            handleSearchSelect(feature, sourceConfig.url, sourceIndex, searchConfig, map);

        } else {
            console.warn("No candidates found for magicKey:", suggestion.magicKey);
        }
    } catch (error) {
        console.error("Error fetching/processing address candidates:", error);
        // Handle error appropriately (e.g., show notification)
    }
};

// PostgREST results or finalized Candidate)
const handleSearchSelect = (
    searchResult: Feature<ExtendedGeometry, GeoJsonProperties> | null,
    _sourceUrl: string,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    const geom = searchResult?.geometry;
    const sourceConfig = searchConfig[sourceIndex];

    if (!geom || !map || !sourceConfig) {
        console.warn("No geometry, map, or valid source config for single feature select.", { geom, map, sourceConfig, sourceIndex });
        return;
    }
    clearGraphics(map);

    try {
        let sourceCRS: string;

        // --- 1. CRS Determination ---
        const outputCrs = searchResult?.properties?.['output_crs']; // This is a common property that will be returned from a PostgREST custom function

        // Handle Masquerade type as a specific case first
        if (sourceConfig.type === 'masquerade') {
            sourceCRS = `EPSG:${sourceConfig.outSR ?? 4326}`;
        }
        // For all other types (like PostgREST)
        // Priority 1: Check for `output_crs` on the feature's properties.
        else if (outputCrs && (typeof outputCrs === 'number' || typeof outputCrs === 'string')) {
            sourceCRS = `EPSG:${outputCrs}`;
        }
        // Priority 2: Check for a non-standard, embedded CRS on the geometry.
        else if ((geom as ExtendedGeometry)?.crs?.properties?.name) {
            const crsName = (geom as ExtendedGeometry).crs?.properties.name || '';
            const epsgMatch = crsName?.match(/EPSG::(\d+)/);
            sourceCRS = epsgMatch?.[1] ? `EPSG:${epsgMatch[1]}` : crsName;
        }
        // Priority 3: Check the explicit search configuration.
        else if (sourceConfig.type === 'postgREST' && sourceConfig.crs) {
            sourceCRS = sourceConfig.crs;
        }
        // Priority 4: Final fallback to WGS84.
        else {
            sourceCRS = "EPSG:4326";
            console.warn(`Could not determine source CRS for feature at index ${sourceIndex}. Assuming ${sourceCRS}. This may be incorrect.`);
        }

        // --- 2. Consistent Highlighting & Zooming ---

        const featureToHighlight: ExtendedFeature = {
            ...searchResult,
            namespace: (searchResult as ExtendedFeature).namespace || ''
        };

        highlightFeature(featureToHighlight, map, sourceCRS, 'Search Box Single Feature Highlight');

        const featureBbox = bbox(geom);
        if (!featureBbox || !featureBbox.every(isFinite)) {
            console.error("Invalid bounding box calculated by turf.bbox:", featureBbox);
            return;
        }

        const targetCRS = "EPSG:4326";
        const [xmin, ymin, xmax, ymax] = convertBbox(featureBbox, sourceCRS, targetCRS);
        const shouldAddScaleValue = geom.type === "Point" ? 13000 : undefined;
        zoomToExtent(xmin, ymin, xmax, ymax, map, shouldAddScaleValue);

    } catch (error) {
        console.error("Error processing single feature selection:", error);
    }
};

interface GeoServerFeatureCollection extends FeatureCollection<ExtendedGeometry, GeoJsonProperties> {
    crs?: {
        type: string;
        properties: {
            name: string;
        };
    };
}

// Handler for FeatureCollection Selection
const handleCollectionSelect = (
    collection: GeoServerFeatureCollection | null,
    _sourceUrl: string | null,
    sourceIndex: number,
    searchConfig: SearchSourceConfig[],
    map: MapLibreMap,
) => {
    if (!collection?.features?.length || !map) {
        console.warn("No features/map for collection select.");
        return;
    }
    clearGraphics(map);

    // --- Definitive CRS Determination Logic ---
    let sourceCRS: string;
    const currentConfig = searchConfig[sourceIndex];
    const firstFeature = collection.features[0];

    // Priority 1: Check for `output_crs` in the feature's properties.
    const outputCrs = firstFeature?.properties?.['output_crs'];
    if (outputCrs && (typeof outputCrs === 'number' || typeof outputCrs === 'string')) {
        sourceCRS = `EPSG:${outputCrs}`;
    }
    // Priority 2: Check for an embedded CRS on the first feature's geometry.
    else if (firstFeature?.geometry?.crs?.properties?.name) {
        const crsName = firstFeature.geometry.crs.properties.name;
        const epsgMatch = crsName.match(/EPSG::(\d+)/);
        sourceCRS = epsgMatch?.[1] ? `EPSG:${epsgMatch[1]}` : crsName;
    }
    // Priority 3: Check the explicit search configuration.
    else if (currentConfig?.type === 'postgREST' && currentConfig.crs) {
        sourceCRS = currentConfig.crs;
    }
    // Priority 4: Final fallback to WGS84 (the GeoJSON standard).
    else {
        sourceCRS = "EPSG:4326";
        console.warn(`Could not determine source CRS for collection search at index ${sourceIndex}. Assuming ${sourceCRS}. This may be incorrect.`);
    }

    try {
        const collectionBbox = bbox(collection);
        if (!collectionBbox.every(isFinite)) {
            console.error("Invalid bounding box calculated for collection");
            return;
        }

        const targetCRS = "EPSG:4326";
        const [xmin, ymin, xmax, ymax] = convertBbox(collectionBbox, sourceCRS, targetCRS);
        zoomToExtent(xmin, ymin, xmax, ymax, map);

        collection.features.forEach(feature => {
            const extendedFeature: ExtendedFeature = { ...feature, namespace: '' };
            highlightFeature(
                extendedFeature,
                map,
                sourceCRS,
                'Search Box Collection Highlight'
            );
        });

    } catch (error) {
        console.error("Error processing feature collection selection:", error);
    }
};

export { SearchCombobox, handleSearchSelect, handleCollectionSelect, handleSuggestionSelect };