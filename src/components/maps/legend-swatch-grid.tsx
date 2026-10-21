import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { SwatchShape } from '@/lib/legend/swatch-shape'
import { LEGEND_ROW_CLASS, LEGEND_SWATCH_SLOT_CLASS } from '@/lib/legend/legend-layout'

export interface LegendSwatchItem {
    key: string
    label: string
    color: string
    stroke?: string
    /** Shown in parentheses after the label; a string is shown as-is (e.g. "12 of 40"). */
    count?: number | string
    /** Greyed out and not toggleable, e.g. a category with no features in view. */
    disabled?: boolean
    /** Right-aligned readout, e.g. "12.3 mi²". Unlike `count`, gets its own column. */
    value?: string
    /** Second readout column, for comparing two measures of the same row. */
    secondaryValue?: string
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
    /**
     * Omit the colour swatch, leaving checkbox + label. Use when the swatch adds
     * nothing — e.g. a grouped symbology legend where every item in the group
     * already shares the coloured group header's shade.
     */
    showSwatch?: boolean
    /** Geometry the swatch stands for: polygons draw as rectangles, lines as a stroke, points as dots. */
    shape?: SwatchShape
}

/**
 * One legend swatch. Painted over the paper tone the map shows, so a transparent or
 * part-transparent colour reads as see-through rather than as the panel.
 */
export function LegendSwatch({ shape = 'circle', color, stroke }: { shape?: SwatchShape; color: string; stroke?: string }) {
    const paint = { backgroundImage: `linear-gradient(${color}, ${color})`, borderColor: stroke ?? 'rgba(0,0,0,0.3)' }
    return (
        <span className={LEGEND_SWATCH_SLOT_CLASS} aria-hidden>
            {shape === 'line' && <span className="h-[3px] w-7 rounded-full" style={{ backgroundColor: color }} />}
            {shape === 'circle' && <span className="legend-swatch size-[9px] rounded-full border-[0.5px]" style={paint} />}
            {shape === 'fill' && <span className="legend-swatch h-3.5 w-7 rounded-[2px] border" style={paint} />}
        </span>
    )
}

/**
 * Shared grid-of-swatches legend body: swatch + label rows.
 * Extracted from the UCRC interactive symbology legend so other legends
 * (e.g. the displacement layers' static Uplift/Subsidence split) can reuse the
 * same visual style without carrying the checkbox/filter wiring.
 */
export function LegendSwatchGrid({ items, isChecked, onToggle, columns = 'auto', showSwatch = true, shape = 'circle' }: LegendSwatchGridProps) {
    if (items.length === 0) return null
    const interactive = !!onToggle
    const containerClassName = columns === 'single'
        ? 'flex flex-col'
        : 'grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-x-6'

    return (
        <div className={containerClassName}>
            {items.map(item => {
                const swatch = showSwatch && <LegendSwatch shape={shape} color={item.color} stroke={item.stroke} />
                const label = (
                    <span className="min-w-0 break-words">
                        {item.label}
                        {item.count != null && <span className="ml-1 text-muted-foreground">({item.count.toLocaleString()})</span>}
                    </span>
                )
                // Fixed min-width aligns numbers into columns across rows.
                const value = item.value != null && (
                    <span className="ml-auto shrink-0 pl-1 min-w-[4.25rem] text-right tabular-nums text-muted-foreground">{item.value}</span>
                )
                const secondaryValue = item.secondaryValue != null && (
                    <span className="shrink-0 pl-2 min-w-[4.25rem] text-right tabular-nums text-muted-foreground">{item.secondaryValue}</span>
                )

                if (!interactive) {
                    return (
                        <div key={item.key} className={cn(LEGEND_ROW_CLASS, 'pr-1')}>
                            {swatch}
                            {label}
                            {value}
                            {secondaryValue}
                        </div>
                    )
                }

                return (
                    <label
                        key={item.key}
                        className={cn(LEGEND_ROW_CLASS, 'pr-1 cursor-pointer', item.disabled && 'opacity-40 cursor-not-allowed')}
                    >
                        <Checkbox
                            className="shrink-0"
                            checked={isChecked?.(item.key) ?? true}
                            disabled={item.disabled}
                            onCheckedChange={() => !item.disabled && onToggle(item.key)}
                            aria-label={`Toggle ${item.label}`}
                        />
                        {swatch}
                        {label}
                        {value}
                        {secondaryValue}
                    </label>
                )
            })}
        </div>
    )
}
