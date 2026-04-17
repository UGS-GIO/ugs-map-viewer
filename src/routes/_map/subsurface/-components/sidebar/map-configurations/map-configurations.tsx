import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import { ucrcWellsWMSTitle, ucrcWellsQualifiedName } from '../../../-data/layers/layers';
import { BOX_TYPE_CODES, BOX_TYPE_COLORS } from '../../../-data/layers/box-type-sprites';
import { useWMSLegend } from '@/hooks/use-wms-legend';
import { PROD_GEOSERVER_URL, PROD_POSTGREST_URL } from '@/lib/constants';
import { MultiSelectCombobox } from '@/components/sidebar/filter/multi-select-combobox';
import { BooleanFilter } from '@/components/sidebar/filter/boolean-filter';
import { parseUCRCFilter, generateUCRCFilter, type UCRCFilterState } from './ucrc-filter';

const SYMBOLOGY_PURPOSE = '';      // empty/undefined treated as default purpose mode
const SYMBOLOGY_BOX_TYPE = 'box-type';

interface PurposeOption {
    label: string;
    color: string;
}

// ─── URL Search Param Helpers ─────────────────────────────────────────────────

/** Read/write a single layer's CQL filter from the `filters` search param record */
const useFilterParam = (recordKey: string) => {
    const navigate = useNavigate({ from: '/subsurface/' });
    const search = useSearch({ from: '/_map/subsurface/' });

    const value = useMemo(
        () => (search.filters as Record<string, string> | undefined)?.[recordKey] ?? '',
        [search.filters, recordKey],
    );

    const setValue = useCallback((newValue: string) => {
        navigate({
            search: (prev) => {
                const current = (prev.filters as Record<string, string> | undefined) || {};
                if (newValue) {
                    return { ...prev, filters: { ...current, [recordKey]: newValue } };
                }
                const { [recordKey]: _, ...rest } = current;
                return { ...prev, filters: Object.keys(rest).length > 0 ? rest : undefined };
            },
            replace: true,
        });
    }, [navigate, recordKey]);

    return { value, setValue };
};

// ─── Filter Manager Hook ─────────────────────────────────────────────────────

const useUCRCFilterManager = () => {
    const { value: cqlFilter, setValue: setCqlFilter } = useFilterParam(ucrcWellsWMSTitle);

    const filterState = useMemo(() => parseUCRCFilter(cqlFilter || undefined), [cqlFilter]);

    const update = useCallback((partial: Partial<UCRCFilterState>) => {
        setCqlFilter(generateUCRCFilter({ ...filterState, ...partial }));
    }, [filterState, setCqlFilter]);

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

// ─── Vector symbology hook (URL-driven) ──────────────────────────────────────

const useVectorSymbology = (layerTitle: string) => {
    const navigate = useNavigate({ from: '/subsurface/' });
    const search = useSearch({ from: '/_map/subsurface/' });

    const value = useMemo(
        () => (search.vector_symbology as Record<string, string> | undefined)?.[layerTitle] ?? SYMBOLOGY_PURPOSE,
        [search.vector_symbology, layerTitle],
    );

    const setValue = useCallback((next: string) => {
        navigate({
            search: (prev) => {
                const current = (prev.vector_symbology as Record<string, string> | undefined) || {};
                if (next && next !== SYMBOLOGY_PURPOSE) {
                    return { ...prev, vector_symbology: { ...current, [layerTitle]: next } };
                }
                const { [layerTitle]: _, ...rest } = current;
                return { ...prev, vector_symbology: Object.keys(rest).length > 0 ? rest : undefined };
            },
            replace: true,
        });
    }, [navigate, layerTitle]);

    return { value, setValue };
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

/** box_type_codes is a comma-separated string column ("BUTTS,CUTTINGS"); split + dedupe. */
const fetchDistinctBoxTypeCodes = async (): Promise<string[]> => {
    const url = `${PROD_POSTGREST_URL}/enmin_ucrc_wells_django_test_current?select=box_type_codes&box_type_codes=not.is.null&box_type_codes=neq.`;
    const res = await fetch(url, {
        headers: { 'Accept-Profile': 'emp', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch box_type_codes');
    const data: { box_type_codes: string }[] = await res.json();
    const seen = new Set<string>();
    for (const row of data) {
        if (typeof row.box_type_codes !== 'string') continue;
        for (const code of row.box_type_codes.split(',')) {
            const trimmed = code.trim();
            if (trimmed) seen.add(trimmed);
        }
    }
    return Array.from(seen).sort();
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

const CoordFormatToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {COORD_OPTIONS.map(opt => (
            <div key={opt.id} className="flex">
                <RadioGroupItem value={opt.value} id={opt.id} className="peer sr-only" />
                <Label htmlFor={opt.id} className={COORD_RADIO_LABEL_CLASS}>{opt.value}</Label>
            </div>
        ))}
    </RadioGroup>
);

const PurposeFilter = ({
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
};

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

const DepthRangeFilter = ({
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
};

// ─── Main Component ──────────────────────────────────────────────────────────

function MapConfigurations() {
    const { setIsDecimalDegrees, locationCoordinateFormat } = useMapCoordinates();
    const { filterState, update, clearAll, hasAnyFilter } = useUCRCFilterManager();
    const { options: purposeOptions, isLoading: purposeLoading } = usePurposeOptions();
    const { value: symbology, setValue: setSymbology } = useVectorSymbology(ucrcWellsWMSTitle);
    const isBoxTypeMode = symbology === SYMBOLOGY_BOX_TYPE;

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
                        <CardTitle>Symbolize UCRC Wells By</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Select value={symbology || 'purpose'} onValueChange={(v) => setSymbology(v === 'purpose' ? '' : v)}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="purpose" className="text-xs">Purpose</SelectItem>
                                <SelectItem value={SYMBOLOGY_BOX_TYPE} className="text-xs">Box Type</SelectItem>
                            </SelectContent>
                        </Select>
                        {isBoxTypeMode && (
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div className="font-medium">Quadrant key</div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    {BOX_TYPE_CODES.map((code, i) => {
                                        const positionLabel = ['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'][i];
                                        return (
                                            <div key={code} className="flex items-center gap-2">
                                                <span
                                                    className="inline-block w-3 h-3 rounded-sm border border-foreground/30 shrink-0"
                                                    style={{ backgroundColor: BOX_TYPE_COLORS[code] }}
                                                />
                                                <span>{code}</span>
                                                <span className="text-[10px] text-muted-foreground/70">({positionLabel})</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[11px] pt-1">Each well is a 2×2 square; quadrants are colored when the well has that box type.</p>
                            </div>
                        )}
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
                            disabledMessage="Coming soon — column not yet loaded"
                        />

                        <MultiSelectCombobox
                            label="Box Type"
                            placeholder="Select box types..."
                            queryKey="ucrc-distinct-box-type-codes"
                            fetchOptions={fetchDistinctBoxTypeCodes}
                            selected={filterState.boxTypes}
                            onChange={(boxTypes) => update({ boxTypes })}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default MapConfigurations;
