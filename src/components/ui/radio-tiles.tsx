import type { ReactNode } from 'react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

interface RadioTilesProps<T extends string> {
  label: string
  value: T | null
  onValueChange: (value: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  itemClassName?: string
  /** Fires on every click, including the checked tile (radios don't report re-picking it) */
  onItemClick?: (value: T) => void
}

/** A grid of choices as tiles, one checked. */
export function RadioTiles<T extends string>({ label, value, onValueChange, options, className, itemClassName, onItemClick }: RadioTilesProps<T>) {
  return (
    // null keeps it controlled with nothing checked
    <RadioGroup<T | null> aria-label={label} value={value} onValueChange={(v) => v !== null && onValueChange(v)} className={cn('grid gap-2', className)}>
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          onClick={() => onItemClick?.(o.value)}
          className={cn(
            'rounded-sm bg-popover p-2 text-center text-sm hover:bg-accent hover:text-accent-foreground data-[checked]:bg-primary data-[checked]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-3',
            itemClassName,
          )}
        >
          {o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
