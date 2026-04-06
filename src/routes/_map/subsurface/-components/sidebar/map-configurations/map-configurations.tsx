import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import { ChevronsUpDown } from 'lucide-react';
import { ucrcWellsWMSTitle, ucrcWellsQualifiedName } from '../../../-data/layers/layers';
import { useWMSLegend } from '@/hooks/use-wms-legend';
import { PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from '@/lib/constants';
import { MultiSelectCombobox } from '@/components/sidebar/filter/multi-select-combobox';
import { BooleanFilter } from '@/components/sidebar/filter/boolean-filter';
import type { YesNoAll } from '@/components/sidebar/filter/boolean-filter';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PurposeOption {
    label: string;
    color: string;
}

// GeoServer named styles for UCRC wells — must match styles uploaded to GeoServer
const SYMBOLIZE_BY_OPTIONS = [
    { value: '', label: 'Default' },
    { value: 'ucrc-wells-purpose', label: 'Purpose' },
    { value: 'ucrc-wells-box-type-placeholder', label: 'Box Type (placeholder)' },
] as const;

interface UCRCFilterState {
    purposes: Set<string>;
    counties: string[];
    operators: string[];
    fields: string[];
    formations: string[];
    depthMin: number | null;
    depthMax: number | null;
    hasPhotos: YesNoAll;
    boxTypes: string[];
}

// ─── CQL Generation ──────────────────────────────────────────────────────────

/** Extract all quoted values for a given CQL field, e.g. "county = 'FOO'" → ['FOO'] */
const extractCqlValues = (cql: string, field: string): string[] => {
    const pattern = new RegExp(`${field}\\s*=\\s*'([^']+)'`, 'g');
    const results: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cql)) !== null) {
        results.push(match[1]);
    }
    return results;
};

const parseUCRCFilter = (cql: string | null | undefined): UCRCFilterState => {
    const state: UCRCFilterState = {
        purposes: new Set(),
        counties: [],
        operators: [],
        fields: [],
        formations: [],
        depthMin: null,
        depthMax: null,
        hasPhotos: 'all',
        boxTypes: [],
    };
    if (!cql) return state;

    state.purposes = new Set(extractCqlValues(cql, 'purpose'));
    state.counties = extractCqlValues(cql, 'county');
    state.operators = extractCqlValues(cql, 'current_operator');
    state.fields = extractCqlValues(cql, 'field_name');
    state.formations = extractCqlValues(cql, 'producing_formation');
    state.boxTypes = extractCqlValues(cql, 'box_type');

    const depthMinMatch = cql.match(/td_ft\s*>=\s*(\d+)/);
    if (depthMinMatch) state.depthMin = Number(depthMinMatch[1]);

    const depthMaxMatch = cql.match(/td_ft\s*<=\s*(\d+)/);
    if (depthMaxMatch) state.depthMax = Number(depthMaxMatch[1]);

    if (cql.includes("has_photos = 'True'")) state.hasPhotos = 'yes';
    else if (cql.includes("has_photos = 'False'")) state.hasPhotos = 'no';

    return state;
};

/** Build a CQL OR clause for a multi-value field, e.g. "(county = 'A' OR county = 'B')" */
const buildCqlOrClause = (field: string, values: string[]): string | null => {
    if (values.length === 0) return null;
    const parts = values.map(v => `${field} = '${v}'`);
    return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

const generateUCRCFilter = (state: UCRCFilterState): string => {
    const boolFilter = (field: string, value: YesNoAll): string | null => {
        if (value === 'yes') return `${field} = 'True'`;
        if (value === 'no') return `${field} = 'False'`;
        return null;
    };

    const parts: (string | null)[] = [
        buildCqlOrClause('purpose', Array.from(state.purposes)),
        buildCqlOrClause('county', state.counties),
        buildCqlOrClause('current_operator', state.operators),
        buildCqlOrClause('field_name', state.fields),
        buildCqlOrClause('producing_formation', state.formations),
        state.depthMin != null ? `td_ft >= ${state.depthMin}` : null,
        state.depthMax != null ? `td_ft <= ${state.depthMax}` : null,
        boolFilter('has_photos', state.hasPhotos),
        buildCqlOrClause('box_type', state.boxTypes),
    ];

    return parts.filter(Boolean).join(' AND ');
};

// ─── URL Search Param Helpers ─────────────────────────────────────────────────

/** Update a keyed record in URL search params, removing the key (and parent) when value is empty */
const useSearchParamRecord = (paramKey: 'filters' | 'layer_styles', recordKey: string) => {
    const navigate = useNavigate({ from: '/subsurface/' });
    const search = useSearch({ from: '/_map/subsurface/' });

    const value = useMemo(() =>
        (search[paramKey] as Record<string, string> | undefined)?.[recordKey] ?? '',
        [search, paramKey, recordKey]
    );

    const setValue = useCallback((newValue: string) => {
        navigate({
            search: (prev) => {
                const current = (prev[paramKey] as Record<string, string> | undefined) || {};
                if (newValue) {
                    return { ...prev, [paramKey]: { ...current, [recordKey]: newValue } };
                }
                const { [recordKey]: _, ...rest } = current;
                return { ...prev, [paramKey]: Object.keys(rest).length > 0 ? rest : undefined };
            },
            replace: true,
        });
    }, [navigate, paramKey, recordKey]);

    return { value, setValue };
};

// ─── Filter Manager Hook ─────────────────────────────────────────────────────

const useUCRCFilterManager = () => {
    const { value: cqlFilter, setValue: setCqlFilter } = useSearchParamRecord('filters', ucrcWellsWMSTitle);

    const filterState = useMemo(() => parseUCRCFilter(cqlFilter || undefined), [cqlFilter]);
    const cqlRef = useRef(cqlFilter);
    cqlRef.current = cqlFilter;

    const update = useCallback((partial: Partial<UCRCFilterState>) => {
        const current = parseUCRCFilter(cqlRef.current || undefined);
        const next = { ...current, ...partial };
        setCqlFilter(generateUCRCFilter(next));
    }, [setCqlFilter]);

    const clearAll = useCallback(() => setCqlFilter(''), [setCqlFilter]);

    const hasAnyFilter = filterState.purposes.size > 0
        || filterState.counties.length > 0
        || filterState.operators.length > 0
        || filterState.fields.length > 0
        || filterState.formations.length > 0
        || filterState.depthMin != null
        || filterState.depthMax != null
        || filterState.hasPhotos !== 'all'
        || filterState.boxTypes.length > 0;

    return { filterState, update, clearAll, hasAnyFilter };
};

// ─── Style Manager Hook ──────────────────────────────────────────────────────

const useStyleManager = () => {
    const { value: activeStyle, setValue: setStyle } = useSearchParamRecord('layer_styles', ucrcWellsWMSTitle);
    return { activeStyle, setStyle };
};

// ─── Data Fetching ───────────────────────────────────────────────────────────

const fetchDistinctValues = async (field: string): Promise<string[]> => {
    const url = `${PROD_POSTGREST_URL}/enmin_ucrc_wells_django_test_current?select=${field}&${field}=not.is.null&${field}=neq.&order=${field}.asc`;
    const res = await fetch(url, {
        headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${field}`);
    const data: Record<string, string>[] = await res.json();
    const seen = new Set<string>();
    const results: string[] = [];
    for (const row of data) {
        const val = row[field];
        if (typeof val === 'string' && val.trim() && !seen.has(val)) {
            seen.add(val);
            results.push(val);
        }
    }
    return results;
};

const usePurposeOptions = (): { options: PurposeOption[]; isLoading: boolean } => {
    const { preview, isLoading } = useWMSLegend(
        ucrcWellsQualifiedName,
        `${PROD_GEOSERVER_URL}/wms`
    );

    const options = useMemo(() =>
        preview
            .filter(p => p.label && p.label !== 'Other / Unknown')
            .map(p => {
                let color = '#808080';
                if (p.html && 'querySelector' in p.html) {
                    const el = p.html.querySelector('circle, rect, ellipse');
                    const fill = el?.getAttribute('fill');
                    if (fill) color = fill;
                }
                return { label: p.label, color };
            }),
        [preview]
    );

    return { options, isLoading };
};

// ─── Sub-Components ──────────────────────────────────────────────────────────

const COORD_RADIO_LABEL_CLASS = "flex flex-1 items-center justify-center rounded-sm bg-popover p-3 text-center hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary [&:has([data-state=checked])]:text-primary-foreground";

const COORD_OPTIONS = [
    { value: 'Decimal Degrees', id: 'decimal-degrees' },
    { value: 'Degrees, Minutes, Seconds', id: 'dms' },
] as const;

const CoordFormatToggle = React.memo(({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {COORD_OPTIONS.map(opt => (
            <div key={opt.id} className="flex">
                <RadioGroupItem value={opt.value} id={opt.id} className="peer sr-only" />
                <Label htmlFor={opt.id} className={COORD_RADIO_LABEL_CLASS}>{opt.value}</Label>
            </div>
        ))}
    </RadioGroup>
));

const PurposeFilter = React.memo(({
    options,
    isLoading,
    selected,
    onChange,
}: {
    options: PurposeOption[];
    isLoading: boolean;
    selected: Set<string>;
    onChange: (purpose: string, checked: boolean) => void;
}) => {
    if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

    return (
        <div className="grid grid-cols-2 gap-2">
            {options.map(({ label, color }) => (
                <div key={label} className="flex items-center space-x-2">
                    <Checkbox
                        id={`purpose-${label}`}
                        checked={selected.has(label)}
                        onCheckedChange={(checked) => onChange(label, checked === true)}
                    />
                    <span
                        className="inline-block w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                    />
                    <Label htmlFor={`purpose-${label}`} className="text-sm cursor-pointer">
                        {label}
                    </Label>
                </div>
            ))}
        </div>
    );
});

const DEPTH_STEP = 100;

const fetchDepthRange = async (): Promise<{ min: number; max: number }> => {
    const [minRes, maxRes] = await Promise.all([
        fetch(
            `${PROD_POSTGREST_URL}/enmin_ucrc_wells_django_test_current?select=td_ft&td_ft=not.is.null&order=td_ft.asc&limit=1`,
            { headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' } },
        ),
        fetch(
            `${PROD_POSTGREST_URL}/enmin_ucrc_wells_django_test_current?select=td_ft&td_ft=not.is.null&order=td_ft.desc&limit=1`,
            { headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' } },
        ),
    ]);
    if (!minRes.ok || !maxRes.ok) throw new Error('Failed to fetch depth range');
    const [minData, maxData]: [{ td_ft: number }[], { td_ft: number }[]] = await Promise.all([minRes.json(), maxRes.json()]);
    return {
        min: Math.floor((minData[0]?.td_ft ?? 0) / DEPTH_STEP) * DEPTH_STEP,
        max: Math.ceil((maxData[0]?.td_ft ?? 25000) / DEPTH_STEP) * DEPTH_STEP,
    };
};

const DepthRangeFilter = React.memo(({
    depthMin,
    depthMax,
    onChange,
}: {
    depthMin: number | null;
    depthMax: number | null;
    onChange: (min: number | null, max: number | null) => void;
}) => {
    const { data: range } = useQuery({
        queryKey: ['ucrc-depth-range'],
        queryFn: fetchDepthRange,
        staleTime: 1000 * 60 * 60,
    });

    const rangeMin = range?.min ?? 0;
    const rangeMax = range?.max ?? 25000;

    // Local drag state — only used while pointer is down on the slider
    const [dragValue, setDragValue] = useState<[number, number] | null>(null);
    const display = dragValue ?? [depthMin ?? rangeMin, depthMax ?? rangeMax];

    return (
        <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                Total Depth (ft)
            </Label>
            <DualRangeSlider
                value={display}
                min={rangeMin}
                max={rangeMax}
                step={DEPTH_STEP}
                onValueChange={([min, max]) => setDragValue([min, max])}
                onValueCommit={([min, max]) => {
                    setDragValue(null);
                    const newMin = min > rangeMin ? min : null;
                    const newMax = max < rangeMax ? max : null;
                    onChange(newMin, newMax);
                }}
                className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{display[0].toLocaleString()} ft</span>
                <span>{display[1].toLocaleString()} ft</span>
            </div>
        </div>
    );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function MapConfigurations() {
    const { setIsDecimalDegrees, locationCoordinateFormat } = useMapCoordinates();
    const { filterState, update, clearAll, hasAnyFilter } = useUCRCFilterManager();
    const { options: purposeOptions, isLoading: purposeLoading } = usePurposeOptions();
    const { activeStyle, setStyle } = useStyleManager();

    const handleCoordFormatChange = (value: string) => {
        if (value && setIsDecimalDegrees) {
            setIsDecimalDegrees(value === "Decimal Degrees");
        }
    };

    const handlePurposeChange = useCallback((purpose: string, checked: boolean) => {
        const next = new Set(filterState.purposes);
        if (checked) next.add(purpose); else next.delete(purpose);
        update({ purposes: next });
    }, [filterState.purposes, update]);

    const handleDepthChange = useCallback((min: number | null, max: number | null) => {
        update({ depthMin: min, depthMax: max });
    }, [update]);

    return (
        <>
            <BackToMenuButton />
            <div className='space-y-2'>
                <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Map Configurations</h3>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Location Coordinate Format</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CoordFormatToggle value={locationCoordinateFormat} onChange={handleCoordFormatChange} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Symbolize By</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Select
                            value={activeStyle || '_default'}
                            onValueChange={(v) => setStyle(v === '_default' ? '' : v)}
                        >
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Default" />
                            </SelectTrigger>
                            <SelectContent>
                                {SYMBOLIZE_BY_OPTIONS.map(opt => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value || '_default'}
                                        className="text-xs"
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>UCRC Wells Filters</span>
                            {hasAnyFilter && (
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Clear all
                                </button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Purpose
                            </Label>
                            <PurposeFilter
                                options={purposeOptions}
                                isLoading={purposeLoading}
                                selected={filterState.purposes}
                                onChange={handlePurposeChange}
                            />
                        </div>

                        <MultiSelectCombobox
                            label="County"
                            placeholder="Select counties..."
                            queryKey="ucrc-distinct-county"
                            fetchOptions={() => fetchDistinctValues('county')}
                            selected={filterState.counties}
                            onChange={(counties) => update({ counties })}
                        />

                        <MultiSelectCombobox
                            label="Operator"
                            placeholder="Select operators..."
                            queryKey="ucrc-distinct-operator"
                            fetchOptions={() => fetchDistinctValues('current_operator')}
                            selected={filterState.operators}
                            onChange={(operators) => update({ operators })}
                        />

                        <MultiSelectCombobox
                            label="Field"
                            placeholder="Select fields..."
                            queryKey="ucrc-distinct-field"
                            fetchOptions={() => fetchDistinctValues('field_name')}
                            selected={filterState.fields}
                            onChange={(fields) => update({ fields })}
                        />

                        <MultiSelectCombobox
                            label="Producing Formation"
                            placeholder="Select formations..."
                            queryKey="ucrc-distinct-formation"
                            fetchOptions={() => fetchDistinctValues('producing_formation')}
                            selected={filterState.formations}
                            onChange={(formations) => update({ formations })}
                        />

                        <DepthRangeFilter
                            depthMin={filterState.depthMin}
                            depthMax={filterState.depthMax}
                            onChange={handleDepthChange}
                        />

                        <BooleanFilter
                            label="Has Core Photos"
                            value={filterState.hasPhotos}
                            onChange={() => {}}
                            disabled
                            disabledMessage="Coming soon — requires pipeline update"
                        />

                        <div>
                            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                                Box Type
                            </Label>
                            <div className="relative">
                                <Button
                                    disabled
                                    variant="outline"
                                    className="w-full justify-between text-xs h-9 opacity-50"
                                >
                                    Select box types...
                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1 italic">Coming soon — requires pipeline update</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default MapConfigurations;
