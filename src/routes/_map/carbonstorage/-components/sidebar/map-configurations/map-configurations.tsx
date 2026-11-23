import React from 'react';
import { TerrainCard } from '@/components/sidebar/terrain-card';
import { CoordinateFormatCard } from '@/components/sidebar/coordinate-format-card';
import { UnitsCard } from '@/components/sidebar/units-card';
import { useState, useMemo, useEffect, useCallback, useId, useRef } from 'react';
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
import { fetchStacAssetHref } from '@/lib/map/stac/stac-layer';
import { wellWithTopsWMSTitle } from '../../../-data/layers/layers';
import {
    parseWellFilter,
    serializeWellFilter,
    type WellFilterState,
    type YesNoAll,
} from '../../../-data/well-filters';
import { Badge } from '@/components/ui/badge';

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
};

interface FormationMapping {
    value: string; // Column name (e.g., 'fm_greenriver')
    label: string; // user-friendly alias (e.g., 'Green River')
}

const fetchFormationData = async (): Promise<FormationMapping[]> => {
    const parquetUrl = await fetchStacAssetHref('enmin_ccs_wells_formation', 'enmin_ccs_wells_formationdepths');
    if (!parquetUrl) {
        throw new Error('Related asset enmin_ccs_wells_formationdepths not found on STAC item enmin_ccs_wells_formation');
    }
    const { withConnection, escapeSql } = await import('@/lib/duckdb/client');
    return withConnection(async (conn) => {
        const query = `
            SELECT DISTINCT formation_alias AS label, formation_name AS value
            FROM read_parquet('${escapeSql(parquetUrl)}')
            WHERE formation_alias IS NOT NULL AND formation_name IS NOT NULL
            ORDER BY formation_alias ASC
        `;
        const result = await conn.query(query);
        return result.toArray().map((r) => {
            const json = r.toJSON() as { label: unknown; value: unknown };
            return {
                label: String(json.label),
                value: String(json.value),
            };
        });
    });
};

const useWellFilterManager = () => {
    const navigate = useNavigate({ from: '/carbonstorage/' });
    const search = useSearch({ from: '/_map/carbonstorage/' });

    const rawFilter = useMemo(() =>
        search.filters?.[wellWithTopsWMSTitle],
        [search.filters]
    );

    const simpleState = useMemo(() =>
        parseWellFilter(rawFilter),
        [rawFilter]
    );

    const stateRef = useRef(simpleState);

    useEffect(() => {
        stateRef.current = simpleState;
    }, [simpleState]);

    const updateFilters = useCallback((newState: Partial<WellFilterState>) => {
        const updatedState: WellFilterState = {
            ...stateRef.current,
            ...newState
        };

        const serialized = serializeWellFilter(updatedState);

        // Get current filters from the search object directly
        navigate({
            search: (prev) => {
                const currentFilters = prev.filters || {};
                let newFilters: Record<string, string> | undefined;

                if (serialized) {
                    newFilters = { ...currentFilters, [wellWithTopsWMSTitle]: serialized };
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
            <div className='space-y-4 p-4 max-h-full overflow-y-auto'>
                <div className="mb-4">
                    <h2 className="text-lg font-medium">Map Configurations</h2>
                </div>

                <CoordinateFormatCard />

                <UnitsCard />

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
                <TerrainCard />
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
    const formationLabelId = useId();
    const formationTriggerId = useId();
    const operatorToggleId = useId();

    return (
        <div>
            <Label id={formationLabelId} className="text-sm font-medium text-muted-foreground mb-2 block">
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
                            id={operatorToggleId}
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
                        htmlFor={operatorToggleId}
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
                        id={formationTriggerId}
                        aria-labelledby={`${formationLabelId} ${formationTriggerId}`}
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