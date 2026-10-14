import { cn } from '@/lib/utils'
import type { ResultsView } from './sheet-model'

const OPTIONS: { value: ResultsView; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
]

/** A segmented control, the iOS form of a switch between two views of the same results. */
export function ResultsViewToggle({ value, onChange }: { value: ResultsView; onChange: (v: ResultsView) => void }) {
  return (
    <div role='group' aria-label='Show results as' className='inline-flex self-start rounded-lg bg-muted p-0.5'>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type='button'
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 rounded-md px-4 text-sm font-medium',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
