import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type YesNoAll = 'yes' | 'no' | 'all';

interface BooleanFilterProps {
    label: string;
    value: YesNoAll;
    onChange: (value: YesNoAll) => void;
    disabled?: boolean;
    disabledMessage?: string;
}

const BooleanFilter = ({
    label: filterLabel,
    value,
    onChange,
    disabled = false,
    disabledMessage,
}: BooleanFilterProps) => {
    // A label like "Has Core Photos" carries spaces, which an id may not: `htmlFor` then matches
    // nothing and each radio reaches the a11y tree unnamed.
    const groupId = useId();
    const labelId = `${groupId}-label`;

    return (
    <div>
        <Label id={labelId} className="text-sm font-medium text-muted-foreground mb-2 block">
            {filterLabel}
        </Label>
        <RadioGroup
            disabled={disabled}
            value={value}
            onValueChange={onChange}
            aria-labelledby={labelId}
            className={cn("grid grid-cols-3 gap-2", disabled && "opacity-50 pointer-events-none")}
        >
            {(['yes', 'no', 'all'] as const).map(val => (
                <div key={val}>
                    <RadioGroupItem
                        value={val}
                        id={`${groupId}-${val}`}
                        className="peer sr-only"
                    />
                    <Label
                        htmlFor={`${groupId}-${val}`}
                        className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-2 text-xs text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                    >
                        {val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'All'}
                    </Label>
                </div>
            ))}
        </RadioGroup>
        {disabledMessage && (
            <p className="text-xs text-muted-foreground mt-1 italic">{disabledMessage}</p>
        )}
    </div>
    );
};

export { BooleanFilter };
export type { YesNoAll };
