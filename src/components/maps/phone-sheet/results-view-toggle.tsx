import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import type { ResultsView } from './sheet-model'

const OPTIONS: { value: ResultsView; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
]

/** A segmented control, the iOS form of a switch between two views of the same results. */
export function ResultsViewToggle({ value, onChange }: { value: ResultsView; onChange: (v: ResultsView) => void }) {
  return (
    <ToggleGroup
      aria-label='Show results as'
      value={[value]}
      // A tap on the pressed option would empty the group; keep the current view instead.
      onValueChange={([next]) => next && onChange(next)}
      className='inline-flex rounded-lg bg-muted p-0.5'
    >
      {OPTIONS.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          className='min-h-11 rounded-md px-3 text-sm font-medium text-muted-foreground data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm'
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
