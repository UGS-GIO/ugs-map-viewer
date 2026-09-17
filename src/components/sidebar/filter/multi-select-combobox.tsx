import { useState, useCallback, useMemo, useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { badgeVariants } from '@/components/ui/badge';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A value the filter stores paired with the text a user reads. */
export interface ComboboxOption {
    value: string;
    label: string;
}

interface MultiSelectComboboxProps {
    label: string;
    placeholder: string;
    /** Plain strings when the stored value IS the label; pairs when they differ. */
    options: readonly (string | ComboboxOption)[];
    /** Optional per-option row counts, shown right-aligned in each item. */
    counts?: Record<string, number>;
    isLoading?: boolean;
    /** Disables the trigger and replaces the empty text. */
    error?: Error | null;
    disabled?: boolean;
    selected: string[];
    onChange: (values: string[]) => void;
    /** Rendered between the label and the chips — e.g. an AND/OR toggle. */
    controls?: ReactNode;
    /** Drawn between chips to show how the selections combine. */
    chipSeparator?: string;
    /** Adds an item that clears the selection, using this text. */
    clearAllLabel?: string;
    /** Trigger text once something is selected. Defaults to "n selected". */
    selectedSummary?: (count: number) => string;
}

const toOption = (option: string | ComboboxOption): ComboboxOption =>
    typeof option === 'string' ? { value: option, label: option } : option;

const MultiSelectCombobox = ({
    label,
    placeholder,
    options,
    counts,
    isLoading = false,
    error = null,
    disabled = false,
    selected,
    onChange,
    controls,
    chipSeparator,
    clearAllLabel,
    selectedSummary,
}: MultiSelectComboboxProps) => {
    const [open, setOpen] = useState(false);
    // `combobox` takes no name from its contents; referencing the label AND the trigger keeps
    // the field name and the current selection in the announced name.
    const labelId = useId();
    // Referencing the trigger too keeps its own text in the name.
    const triggerId = useId();

    const items = useMemo(() => options.map(toOption), [options]);
    const labels = useMemo(() => new Map(items.map(o => [o.value, o.label])), [items]);

    const handleSelect = useCallback((value: string) => {
        if (selected.includes(value)) onChange(selected.filter(v => v !== value));
        else onChange([...selected, value]);
    }, [selected, onChange]);

    const handleRemove = useCallback((value: string) => {
        onChange(selected.filter(v => v !== value));
    }, [selected, onChange]);

    const summary = selectedSummary?.(selected.length) ?? `${selected.length} selected`;

    return (
        <div>
            <Label id={labelId} className="text-sm font-medium text-muted-foreground mb-2 block">{label}</Label>

            {controls}

            {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1">
                    {selected.map((value, index) => (
                        <div key={value} className="flex items-center">
                            {index > 0 && chipSeparator && (
                                <span className="mr-1 text-xs text-muted-foreground">{chipSeparator}</span>
                            )}
                            {/* A real button: a chip is the only way to drop one selection. */}
                            <button
                                type="button"
                                onClick={() => handleRemove(value)}
                                aria-label={`Remove ${labels.get(value) ?? value}`}
                                className={cn(badgeVariants({ variant: 'default' }), 'cursor-pointer text-xs')}
                            >
                                {labels.get(value) ?? value}
                                <X className="ml-1 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        id={triggerId}
                        role="combobox"
                        aria-labelledby={`${labelId} ${triggerId}`}
                        aria-expanded={open}
                        className="w-full justify-between text-xs h-9"
                        disabled={disabled || isLoading || !!error}
                    >
                        {selected.length === 0 ? placeholder : summary}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-8 text-xs" />
                        <CommandList>
                            <CommandEmpty>
                                {isLoading ? 'Loading...' : error ? 'Error loading data' : 'No results.'}
                            </CommandEmpty>
                            <CommandGroup>
                                {/* cmdk keys items by value; an empty one drops the whole list out
                                    of keyboard navigation, so every item carries a real one. */}
                                {clearAllLabel && (
                                    <CommandItem
                                        value={clearAllLabel.toLowerCase()}
                                        onSelect={() => onChange([])}
                                        className="text-xs"
                                    >
                                        <Check className={cn('mr-2 h-3 w-3', selected.length === 0 ? 'opacity-100' : 'opacity-0')} />
                                        {clearAllLabel}
                                    </CommandItem>
                                )}
                                {items.map(({ value, label: optionLabel }) => (
                                    <CommandItem
                                        key={value}
                                        value={(optionLabel.trim() || value).toLowerCase()}
                                        onSelect={() => handleSelect(value)}
                                        className="text-xs"
                                    >
                                        <Check className={cn(
                                            'mr-2 h-3 w-3',
                                            selected.includes(value) ? 'opacity-100' : 'opacity-0'
                                        )} />
                                        {optionLabel}
                                        {counts?.[value] != null && (
                                            <span className="ml-auto pl-2 text-muted-foreground">{counts[value].toLocaleString()}</span>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export { MultiSelectCombobox };
