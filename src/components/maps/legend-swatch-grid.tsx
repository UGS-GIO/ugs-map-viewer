import { Checkbox } from '@/components/ui/checkbox'

export interface LegendSwatchItem {
    key: string
    label: string
    color: string
    stroke?: string
    count?: number
}

interface LegendSwatchGridProps {
    items: LegendSwatchItem[]
    /**
     * Provide both to make each row an interactive checkbox toggle (the UCRC
     * symbology-legend usage — toggling a category filters the map). Omit
     * both for a static, read-only legend (a swatch + label, nothing to
     * toggle against — e.g. WMS raster classes that aren't a filterable
     * vector field).
     */
    isChecked?: (key: string) => boolean
    onToggle?: (key: string) => void
    /**
     * 'auto' (default): auto-fitting columns (2-up when there's room, 1-up on
     * narrow screens) — fits a single wide categorical field, e.g. UCRC.
     * 'single': always one column, no minimum item width. Use this when the
     * grid is already nested inside a narrower split (e.g. a 2-up Uplift/
     * Subsidence layout) — 'auto's minmax(8rem,...) forces items wider than
     * their half-width column there and overflows the panel.
     */
    columns?: 'auto' | 'single'
}

/**
 * Shared grid-of-swatches legend body: circular swatch + label rows.
 * Extracted from the UCRC interactive symbology legend so other legends
 * (e.g. the displacement layers' static Uplift/Subsidence split) can reuse the
 * same visual style without carrying the checkbox/filter wiring.
 */
export function LegendSwatchGrid({ items, isChecked, onToggle, columns = 'auto' }: LegendSwatchGridProps) {
    if (items.length === 0) return null
    const interactive = !!onToggle
    const containerClassName = columns === 'single'
        ? 'flex flex-col gap-y-1.5'
        : 'grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6 gap-y-1.5'

    return (
        <div className={containerClassName}>
            {items.map(item => {
                const swatch = (
                    <span
                        className="mt-0.5 inline-block w-3 h-3 rounded-full shrink-0 border"
                        style={{ backgroundColor: item.color, borderColor: item.stroke ?? 'rgba(0,0,0,0.3)' }}
                        aria-hidden
                    />
                )
                const label = (
                    <span className="min-w-0 break-words leading-tight">
                        {item.label}
                        {item.count != null && <span className="ml-1 text-muted-foreground">({item.count.toLocaleString()})</span>}
                    </span>
                )

                if (!interactive) {
                    return (
                        <div key={item.key} className="flex min-w-0 items-start gap-1.5 pr-1 text-xs">
                            {swatch}
                            {label}
                        </div>
                    )
                }

                return (
                    <label key={item.key} className="flex min-w-0 items-start gap-1.5 pr-1 text-xs cursor-pointer">
                        <Checkbox
                            className="mt-0.5 shrink-0"
                            checked={isChecked?.(item.key) ?? true}
                            onCheckedChange={() => onToggle(item.key)}
                            aria-label={`Toggle ${item.label}`}
                        />
                        {swatch}
                        {label}
                    </label>
                )
            })}
        </div>
    )
}
