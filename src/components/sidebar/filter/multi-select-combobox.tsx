import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiSelectComboboxProps {
    label: string;
    placeholder: string;
    options: string[];
    isLoading?: boolean;
    selected: string[];
    onChange: (values: string[]) => void;
}

const MultiSelectCombobox = ({
    label,
    placeholder,
    options,
    isLoading = false,
    selected,
    onChange,
}: MultiSelectComboboxProps) => {
    const [open, setOpen] = useState(false);

    const handleSelect = useCallback((value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    }, [selected, onChange]);

    const handleRemove = useCallback((value: string) => {
        onChange(selected.filter(v => v !== value));
    }, [selected, onChange]);

    return (
        <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">{label}</Label>

            {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                    {selected.map(val => (
                        <Badge
                            key={val}
                            variant="default"
                            className="cursor-pointer flex items-center text-xs"
                            onClick={() => handleRemove(val)}
                        >
                            {val}
                            <X className="ml-1 h-3 w-3 flex-shrink-0" />
                        </Badge>
                    ))}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between text-xs h-9"
                        disabled={isLoading}
                    >
                        {selected.length === 0
                            ? placeholder
                            : `${selected.length} selected`}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-8 text-xs" />
                        <CommandList>
                            <CommandEmpty>{isLoading ? 'Loading...' : 'No results.'}</CommandEmpty>
                            <CommandGroup>
                                {options.map(opt => (
                                    <CommandItem
                                        key={opt}
                                        value={opt}
                                        onSelect={() => handleSelect(opt)}
                                        className="text-xs"
                                    >
                                        <Check className={cn(
                                            "mr-2 h-3 w-3",
                                            selected.includes(opt) ? "opacity-100" : "opacity-0"
                                        )} />
                                        {opt}
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
