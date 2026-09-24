import { cn, formatNumeric } from '@/lib/utils'
import type { DisplayField } from '@/lib/types/mapping-types'

export interface OutlineCardProps {
  recordIndex: number
  totalRecords: number
  row: Record<string, unknown>
  allRows?: Record<string, unknown>[]
  displayFields?: DisplayField[]
  className?: string
}

export function OutlineCard({
  recordIndex,
  totalRecords,
  row,
  allRows,
  displayFields,
  className,
}: OutlineCardProps) {
  return (
    <div
      className={cn(
        'space-y-2.5 rounded-md border p-3 text-sm shadow-sm',
        className
      )}
    >
      {totalRecords > 1 && (
        <div className='border-b pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          Record {recordIndex + 1} of {totalRecords}
        </div>
      )}
      {displayFields?.map((df) => {
        const raw = row[df.field]
        const formatted = formatNumeric(raw, df.format)
        const value = df.transform
          ? df.transform(formatted, row, allRows)
          : formatted
        const displayValue =
          value === undefined || value === null || value === '' ? '—' : value
        return (
          <div key={df.field} className='flex flex-col gap-0.5'>
            <span className='font-semibold text-foreground'>
              {df.label || df.field}
            </span>
            <div className='break-words leading-relaxed text-muted-foreground'>
              {displayValue}
            </div>
          </div>
        )
      })}
    </div>
  )
}
