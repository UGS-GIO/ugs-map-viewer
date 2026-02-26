import React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMap } from '@/hooks/use-map';
import { wellWithTopsWMSTitle } from '../../../-data/layers/layers';
import { Badge } from '@/components/ui/badge';
import { applyLayerFilter } from '@/lib/sidebar/filter/util';

type YesNoAll = "yes" | "no" | "all";

interface FilterState {
    core: YesNoAll;
    las: YesNoAll;
    formations: string[];
    formation_operator?: 'and';
}

const wellsHasCoreFilterConfig = {
    label: "Cores/Cuttings Available?",
    options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "all", label: "All" }
    ] as const,
};

const wellsHasLasFilterConfig = {
    label: "LAS Data Available?",
    options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "all", label: "All" }
    ] as const,
};

const formationNameMappingConfig = {
    label: "Formation Present",
    postgrestUrl: "https://postgrest-seamlessgeolmap-734948684426.us-central1.run.app",
    tableName: "view_wellswithtops_hascore",
    fieldsToSelect: "formation_alias,formation_name",
    displayField: "formation_alias",
    columnNameField: "formation_name",
    acceptProfile: "emp"
};

interface FormationMapping {
    value: string; // GeoServer column name (e.g., 'fm_greenriver')
    label: string; // user-friendly alias (e.g., 'Green River')
}

const fetchFormationData = async (): Promise<FormationMapping[]> => {
    const {
        postgrestUrl,
        tableName,
        fieldsToSelect,
        displayField,
        columnNameField,
        acceptProfile
    } = formationNameMappingConfig;

    const url = `${postgrestUrl}/${tableName}?select=${fieldsToSelect}`;
    const response = await fetch(url, {
        headers: {
            "Accept-Profile": acceptProfile,
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error fetching formation mappings! status: ${response.status}`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
        throw new Error('Expected array response from formation data endpoint');
    }

    const uniqueMappings = new Map<string, string>();

    for (const item of data) {
        if (typeof item !== 'object' || item === null) continue;

        const alias = displayField in item ? item[displayField] : undefined;
        const columnName = columnNameField in item ? item[columnNameField] : undefined;

        if (typeof alias === 'string' && typeof columnName === 'string' && !uniqueMappings.has(alias)) {
            uniqueMappings.set(alias, columnName);
        }
    }

    return Array.from(uniqueMappings, ([label, value]) => ({ label, value }))
        .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Parses a CQL filter string into a simplified filter state object.
 * Handles 'hascore', 'has_las', and formation presence filters.
 * @param cqlFilter - The CQL filter string from the URL or null/undefined.
 * @returns A FilterState object representing the simplified filter state.
 **/
const parseCQLFilter = (cqlFilter: string | null | undefined): FilterState => {
    if (!cqlFilter) {
        return { core: 'all', las: 'all', formations: [], formation_operator: undefined };
    }

    const core: YesNoAll = cqlFilter.includes(`hascore = 'True'`)
        ? 'yes'
        : cqlFilter.includes(`hascore = 'False'`)
            ? 'no'
            : 'all';

    const las: YesNoAll = cqlFilter.includes(`has_las = 'True'`)
        ? 'yes'
        : cqlFilter.includes(`has_las = 'False'`)
            ? 'no'
            : 'all';

    const formationMatches = cqlFilter.match(/\b([a-zA-Z0-9_]+)\s+IS NOT NULL/gi) || [];
    const formations = formationMatches.map(match => match.split(' ')[0]);

    let formation_operator: 'and' | undefined = undefined;

    // Only determine the operator if there are multiple formations to join.
    if (formations.length > 1) {
        // this regex checks for "AND" between two "IS NOT NULL" clauses
        // - case-insensitive (/i)
        // - handles variable whitespace (\s+)
        // - avoids the bug of matching ANDs between filter groups
        const hasAndBetweenFormations =
            /IS\s+NOT\s+NULL\s*\)?\s*AND\s*\(?\s*[a-zA-Z0-9_]+\s+IS\s+NOT\s+NULL/i.test(cqlFilter);

        if (hasAndBetweenFormations) {
            formation_operator = 'and';
        }
    }

    return { core, las, formations, formation_operator };
};

const generateCQLFilter = (state: FilterState) => {
    const { core, las, formations, formation_operator } = state;

    const wellFilterParts: string[] = [];
    if (core === "yes") wellFilterParts.push(`hascore = 'True'`);
    if (core === "no") wellFilterParts.push(`hascore = 'False'`);
    if (las === "yes") wellFilterParts.push(`has_las = 'True'`);
    if (las === "no") wellFilterParts.push(`has_las = 'False'`);

    if (formations && formations.length > 0) {
        const operator = formation_operator === 'and' ? ' AND ' : ' OR ';
        const formationFilter = formations.map(f => `${f} IS NOT NULL`).join(operator);
        wellFilterParts.push(formations.length > 1 ? `(${formationFilter})` : formationFilter);
    }

    return wellFilterParts.join(' AND ');
};

/**
    * Custom hook to manage well filter state and URL synchronization.
    * Encapsulates logic for parsing URL filters and updating them.
    * @returns An object containing the simplified filter state and an update function.
**/
const useWellFilterManager = () => {
    const navigate = useNavigate({ from: '/carbonstorage' });
    const search = useSearch({ from: '/_map/carbonstorage/' });

    const cqlFilter = useMemo(() =>
        search.filters?.[wellWithTopsWMSTitle],
        [search.filters]
    );

    const simpleState = useMemo(() =>
        parseCQLFilter(cqlFilter),
        [cqlFilter]
    );

    const stateRef = useRef(simpleState);

    useEffect(() => {
        stateRef.current = simpleState;
    }, [simpleState]);

    const updateFilters = useCallback((newState: Partial<FilterState>) => {
        const updatedState: FilterState = {
            ...stateRef.current,
            ...newState
        };

        const combinedWellFilter = generateCQLFilter(updatedState);

        // Get current filters from the search object directly
        navigate({
            search: (prev) => {
                const currentFilters = prev.filters || {};
                let newFilters: Record<string, string> | undefined;

                if (combinedWellFilter) {
                    newFilters = { ...currentFilters, [wellWithTopsWMSTitle]: combinedWellFilter };
                } else {
                    const { [wellWithTopsWMSTitle]: _, ...rest } = currentFilters;
                    newFilters = Object.keys(rest).length > 0 ? rest : undefined;
                }

                return { ...prev, filters: newFilters };
            },
            replace: true,
        });
    }, [navigate]);

    return { simpleState, updateFilters };
};

const MapConfigurations = () => {
    const { map } = useMap();
    const navigate = useNavigate({ from: '/carbonstorage' });
    const search = useSearch({ from: '/_map/carbonstorage/' });

    const { simpleState, updateFilters } = useWellFilterManager();
    const { core, las, formations, formation_operator } = simpleState;

    const {
        data: formationMappings = [],
        isLoading: isFormationLoading,
        error: formationError
    } = useQuery({
        queryKey: queryKeys.carbonStorage.formations(),
        queryFn: fetchFormationData,
        staleTime: 1000 * 60 * 60,
    });

    // Apply filter to map when it changes
    useEffect(() => {
        if (!map) {
            return;
        }

        const filterFromUrl = search.filters?.[wellWithTopsWMSTitle] ?? null;

        applyLayerFilter(map, wellWithTopsWMSTitle, filterFromUrl);
    }, [map, search.filters]);

    const handleCoordFormatChange = useCallback((value: 'dd' | 'dms') => {
        navigate({
            search: (prev) => ({ ...prev, coordinate_format: value }),
            replace: true
        });
    }, [navigate]);

    const handleHasCoreChange = useCallback((value: YesNoAll) => {
        updateFilters({ core: value });
    }, [updateFilters]);

    const handleHasLasChange = useCallback((value: YesNoAll) => {
        updateFilters({ las: value });
    }, [updateFilters]);

    const handleFormationChange = useCallback((newFormations: string[]) => {
        updateFilters({ formations: newFormations });
    }, [updateFilters]);

    const handleFormationOperatorChange = useCallback((useAnd: boolean) => {
        updateFilters({ formation_operator: useAnd ? 'and' : undefined });
    }, [updateFilters]);

    return (
        <>
            <BackToMenuButton />
            <div className='space-y-4 p-4 max-h-full overflow-y-auto'>
                <div className="mb-4">
                    <h3 className="text-lg font-medium">Map Configurations</h3>
                </div>

                {/* Card for Coordinate Format */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base">Location Coordinate Format</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <RadioGroup
                            value={search.coordinate_format ?? 'dd'}
                            onValueChange={handleCoordFormatChange}
                            className="grid grid-cols-2 gap-2"
                        >
                            <div>
                                <RadioGroupItem
                                    value="dd"
                                    id="dd-radio"
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor="dd-radio"
                                    className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-3 text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                                >
                                    Decimal Degrees
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem
                                    value="dms"
                                    id="dms-radio"
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor="dms-radio"
                                    className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-3 text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                                >
                                    Degrees, Minutes, Seconds
                                </Label>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>

                {/* Card for Wells Database Filter */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base">Filter Wells Database</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <WellCoreFilter
                            disabled={false}
                            value={core}
                            onChange={handleHasCoreChange}
                        />

                        <WellLasFilter
                            disabled={false}
                            value={las}
                            onChange={handleHasLasChange}
                        />

                        <WellFormationFilter
                            disabled={false}
                            value={formations}
                            onChange={handleFormationChange}
                            mappings={formationMappings}
                            isLoading={isFormationLoading}
                            error={formationError}
                            useAndOperator={formation_operator === 'and'}
                            onOperatorChange={handleFormationOperatorChange}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

// --- SUB-COMPONENTS ---
const WellCoreFilter = React.memo(({
    value,
    onChange,
    disabled
}: {
    value: YesNoAll,
    onChange: (value: YesNoAll) => void,
    disabled: boolean
}) => (
    <div>
        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
            {wellsHasCoreFilterConfig.label}
        </Label>
        <RadioGroup
            disabled={disabled}
            value={value}
            onValueChange={onChange}
            className="grid grid-cols-3 gap-2"
        >
            {wellsHasCoreFilterConfig.options.map(option => (
                <div key={option.value}>
                    <RadioGroupItem
                        value={option.value}
                        id={`hascore-filter-${option.value}`}
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor={`hascore-filter-${option.value}`}
                        className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-2 text-xs text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                    >
                        {option.label}
                    </Label>
                </div>
            ))}
        </RadioGroup>
    </div>
));

const WellLasFilter = React.memo(({
    value,
    onChange,
    disabled
}: {
    value: YesNoAll,
    onChange: (value: YesNoAll) => void,
    disabled: boolean
}) => (
    <div>
        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
            {wellsHasLasFilterConfig.label}
        </Label>
        <RadioGroup
            disabled={disabled}
            value={value}
            onValueChange={onChange}
            className="grid grid-cols-3 gap-2"
        >
            {wellsHasLasFilterConfig.options.map(option => (
                <div key={option.value}>
                    <RadioGroupItem
                        value={option.value}
                        id={`haslas-filter-${option.value}`}
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor={`haslas-filter-${option.value}`}
                        className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-2 text-xs text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                    >
                        {option.label}
                    </Label>
                </div>
            ))}
        </RadioGroup>
    </div>
));

interface WellFormationFilterProps {
    disabled: boolean;
    value: string[];
    onChange: (value: string[]) => void;
    mappings: FormationMapping[];
    isLoading: boolean;
    error: Error | null;
    useAndOperator: boolean;
    onOperatorChange: (useAnd: boolean) => void;
}

const WellFormationFilter = React.memo(({
    disabled,
    value,
    onChange,
    mappings,
    isLoading,
    error,
    useAndOperator,
    onOperatorChange
}: WellFormationFilterProps) => {
    const [open, setOpen] = useState(false);

    const handleSelect = useCallback((formationValue: string) => {
        const isSelected = value.includes(formationValue);
        if (formationValue === "") {
            onChange([]);
        } else if (isSelected) {
            onChange(value.filter(v => v !== formationValue));
        } else {
            onChange([...value, formationValue]);
        }
    }, [value, onChange]);

    const removeFormation = useCallback((formationValue: string) =>
        onChange(value.filter(v => v !== formationValue)),
        [value, onChange]
    );

    const formationLabels = useMemo(() =>
        new Map(mappings.map(m => [m.value, m.label])),
        [mappings]
    );

    return (
        <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                {formationNameMappingConfig.label}
            </Label>

            {value.length > 1 && (
                <div className="mb-3 flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            !useAndOperator ? "text-primary" : "text-muted-foreground"
                        )}>
                            OR
                        </span>
                        <Switch
                            id="formation-operator-toggle"
                            checked={useAndOperator}
                            onCheckedChange={onOperatorChange}
                        />
                        <span className={cn(
                            "text-xs font-medium transition-colors",
                            useAndOperator ? "text-primary" : "text-muted-foreground"
                        )}>
                            AND
                        </span>
                    </div>
                    <Label
                        htmlFor="formation-operator-toggle"
                        className="text-xs text-muted-foreground cursor-pointer"
                    >
                        {useAndOperator
                            ? "Wells must have all selected formations"
                            : "Wells can have any selected formation"
                        }
                    </Label>
                </div>
            )}

            {value.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                    {value.map((formationValue, index) => {
                        const label = formationLabels.get(formationValue) || formationValue;
                        return (
                            <div key={formationValue} className="flex items-center">
                                {index > 0 && (
                                    <span className="text-xs text-muted-foreground mr-2">
                                        {useAndOperator ? 'AND' : 'OR'}
                                    </span>
                                )}
                                <Badge
                                    variant="default"
                                    className="cursor-pointer flex items-center"
                                    onClick={() => removeFormation(formationValue)}
                                >
                                    {label}
                                    <X className="ml-1 h-3 w-3 flex-shrink-0" />
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        disabled={disabled || isLoading || !!error}
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between text-xs h-9"
                    >
                        {value.length === 0
                            ? "Select formations..."
                            : `${value.length} formation${value.length === 1 ? '' : 's'} selected`
                        }
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search formation..." className="h-8 text-xs" />
                        <CommandList>
                            <CommandEmpty>
                                {isLoading
                                    ? "Loading..."
                                    : error
                                        ? "Error loading data"
                                        : "No formations found."
                                }
                            </CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    value=""
                                    onSelect={() => handleSelect("")}
                                    className="text-xs"
                                >
                                    <Check className={cn(
                                        "mr-2 h-3 w-3",
                                        value.length === 0 ? "opacity-100" : "opacity-0"
                                    )} />
                                    Clear All Selections
                                </CommandItem>
                                {mappings.map(mapping => {
                                    const isSelected = value.includes(mapping.value);
                                    return (
                                        <CommandItem
                                            key={mapping.value}
                                            value={mapping.label}
                                            onSelect={() => handleSelect(mapping.value)}
                                            className="text-xs"
                                        >
                                            <Check className={cn(
                                                "mr-2 h-3 w-3",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )} />
                                            {mapping.label}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
});

WellCoreFilter.displayName = 'WellCoreFilter';
WellLasFilter.displayName = 'WellLasFilter';
WellFormationFilter.displayName = 'WellFormationFilter';

export default React.memo(MapConfigurations);