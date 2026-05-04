import { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DualRangeSlider } from '@/components/ui/dual-range-slider';
import { MultiSelectCombobox } from '@/components/sidebar/filter/multi-select-combobox';
import { BooleanFilter } from '@/components/sidebar/filter/boolean-filter';
import { useLayerFilter } from '@/hooks/use-layer-filter';
import { useDistinctFieldOptions } from '@/hooks/use-distinct-field-options';
import { useFieldRangeExtent } from '@/hooks/use-field-range-extent';
import type {
    FilterSchema,
    FilterFieldKind,
    FilterState,
    FilterFieldValue,
} from '@/lib/filter/types';

/* ─── Field renderers ──────────────────────────────────────────────────── */

interface FieldProps<K extends FilterFieldKind = FilterFieldKind> {
    schema: FilterSchema;
    state: FilterState;
    field: K;
    onChange: (value: FilterFieldValue) => void;
}

function MultiSelectGrid({ schema, state, field, onChange }: FieldProps<Extract<FilterFieldKind, { kind: 'multiSelect' }>>) {
    const { data: options = [], isLoading } = useDistinctFieldOptions({ schema, state, field });
    const selected = state[field.field]?.kind === 'multiSelect' ? (state[field.field] as { values: string[] }).values : [];
    const filtered = field.optionLabelFilter ? options.filter(field.optionLabelFilter) : options;

    const toggle = (label: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(label); else next.delete(label);
        onChange({ kind: 'multiSelect', values: Array.from(next) });
    };

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

    return (
        <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">{field.label}</Label>
            <div className="grid grid-cols-2 gap-2">
                {filtered.map(label => (
                    <div key={label} className="flex items-center space-x-2">
                        <Checkbox
                            id={`${field.field}-${label}`}
                            checked={selected.includes(label)}
                            onCheckedChange={checked => toggle(label, checked === true)}
                        />
                        {field.optionSwatches?.[label] && (
                            <span
                                className="inline-block w-3 h-3 rounded-full shrink-0 border"
                                style={{
                                    backgroundColor: field.optionSwatches[label],
                                    borderColor: field.optionStrokes?.[label] ?? 'rgba(0,0,0,0.3)',
                                }}
                            />
                        )}
                        <Label htmlFor={`${field.field}-${label}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MultiSelectComboboxField({ schema, state, field, onChange }: FieldProps<Extract<FilterFieldKind, { kind: 'multiSelect' | 'containsAny' }>>) {
    const { data: options = [], isLoading } = useDistinctFieldOptions({
        schema,
        state,
        field,
        splitCommaDelimited: field.kind === 'containsAny',
    });
    const value = state[field.field];
    const selected = value && (value.kind === 'multiSelect' || value.kind === 'containsAny') ? value.values : [];

    return (
        <MultiSelectCombobox
            label={field.label}
            placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}...`}
            options={options}
            isLoading={isLoading}
            selected={selected}
            onChange={(values) => onChange({ kind: field.kind, values })}
        />
    );
}

function RangeField({ schema, state, field, onChange }: FieldProps<Extract<FilterFieldKind, { kind: 'range' }>>) {
    const { data: extent } = useFieldRangeExtent({ schema, field });
    const rangeMin = extent?.min ?? 0;
    const rangeMax = extent?.max ?? 0;
    const step = field.step ?? 1;
    const v = state[field.field];
    const currentMin = v?.kind === 'range' ? v.min : null;
    const currentMax = v?.kind === 'range' ? v.max : null;

    const [dragValue, setDragValue] = useState<[number, number] | null>(null);
    const display = dragValue ?? [currentMin ?? rangeMin, currentMax ?? rangeMax];

    return (
        <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                {field.label}{field.units ? ` (${field.units})` : ''}
            </Label>
            <DualRangeSlider
                value={display}
                min={rangeMin}
                max={rangeMax}
                step={step}
                onValueChange={([min, max]) => setDragValue([min, max])}
                onValueCommit={([min, max]) => {
                    setDragValue(null);
                    onChange({
                        kind: 'range',
                        min: min > rangeMin ? min : null,
                        max: max < rangeMax ? max : null,
                    });
                }}
                className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{display[0].toLocaleString()}{field.units ? ` ${field.units}` : ''}</span>
                <span>{display[1].toLocaleString()}{field.units ? ` ${field.units}` : ''}</span>
            </div>
        </div>
    );
}

function BooleanField({ state, field, onChange }: FieldProps<Extract<FilterFieldKind, { kind: 'boolean' }>>) {
    const v = state[field.field];
    const value = v?.kind === 'boolean' ? v.value : 'all';
    return (
        <BooleanFilter
            label={field.label}
            value={value}
            onChange={(next) => onChange({ kind: 'boolean', value: next })}
            disabled={!!field.disabled}
            disabledMessage={field.disabled?.message}
        />
    );
}

/* ─── Panel ────────────────────────────────────────────────────────────── */

export interface LayerFilterPanelProps {
    schema: FilterSchema;
    /** Card title; default "Filters". */
    title?: string;
}

export function LayerFilterPanel({ schema }: LayerFilterPanelProps) {
    const mgr = useLayerFilter(schema);

    const onFieldChange = useCallback((fieldName: string, value: FilterFieldValue) => {
        mgr.setField(fieldName, value);
    }, [mgr]);

    return (
        <div className="space-y-4">
            {schema.fields.map(field => {
                const key = field.field;
                const onChange = (v: FilterFieldValue) => onFieldChange(key, v);
                switch (field.kind) {
                    case 'multiSelect':
                        // Fields with swatch config render inline grid; others use combobox.
                        return field.optionSwatches
                            ? <MultiSelectGrid key={key} schema={schema} state={mgr.state} field={field} onChange={onChange} />
                            : <MultiSelectComboboxField key={key} schema={schema} state={mgr.state} field={field} onChange={onChange} />;
                    case 'containsAny':
                        return <MultiSelectComboboxField key={key} schema={schema} state={mgr.state} field={field} onChange={onChange} />;
                    case 'range':
                        return <RangeField key={key} schema={schema} state={mgr.state} field={field} onChange={onChange} />;
                    case 'boolean':
                        return <BooleanField key={key} schema={schema} state={mgr.state} field={field} onChange={onChange} />;
                }
            })}
        </div>
    );
}

export { useLayerFilter };
