import { useEffect } from 'react'
import { useIsTooltipActive, useActiveTooltipLabel } from 'recharts'

// Shared "static readout instead of a floating tooltip" plumbing for the
// displacement charts. Recharts' floating <Tooltip> box tracks the cursor and
// overlaps the plot; reviewers asked for the reading to sit in one fixed spot
// beneath each chart and just update on hover. So every chart keeps a <Tooltip>
// (for its hover cursor + to keep the tooltip hooks live) but renders nothing in
// it, reports the hovered category up, and the parent draws ChartHoverReadout
// below the figure. Mirrors the onHover→legend pattern StackedYearChart already
// uses.

// Renders nothing — lifts the hovered category label to the parent via an
// effect (keeps setState out of render). The recharts tooltip hooks only
// resolve inside a chart, so the reporter has to live in the tree.
export function HoveredChartLabelReporter({ onHover }: { onHover: (label: string | null) => void }) {
    const isActive = useIsTooltipActive()
    const label = useActiveTooltipLabel()
    const hovered = isActive && (typeof label === 'string' || typeof label === 'number') ? String(label) : null

    useEffect(() => {
        onHover(hovered)
    }, [hovered, onHover])

    return null
}

// A <Tooltip content> that draws no floating box. The cursor still shows and the
// tooltip hooks stay live; the reading moves to ChartHoverReadout below.
export const renderNoChartTooltip = () => null

export interface ChartReadoutItem {
    /** Series/label text, e.g. "Maximum Subsidence · Cedar Valley". */
    label: string
    /** Preformatted value with units, e.g. "5.2 in" / "12.3 mi²". */
    value: string
    /** Optional swatch color for multi-series charts. */
    color?: string
}

// The static, below-the-chart reading. Reserves a fixed min-height so the panel
// doesn't jump between the hover and rest states, and announces politely so it
// carries the same information the removed tooltip gave assistive tech.
export function ChartHoverReadout({
    activeLabel,
    items,
    placeholder = 'Hover the chart for details',
}: {
    activeLabel: string | null
    items: ChartReadoutItem[]
    placeholder?: string
}) {
    const show = activeLabel != null && items.length > 0
    return (
        <div
            aria-live="polite"
            className="mt-1 flex min-h-[1.75rem] flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md bg-muted/40 px-2 py-1 text-xs"
        >
            {show ? (
                <>
                    <span className="font-semibold text-foreground">{activeLabel}</span>
                    {items.map(it => (
                        <span key={it.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
                            {it.color && <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: it.color }} />}
                            <span>{it.label}</span>
                            <span className="font-medium text-foreground">{it.value}</span>
                        </span>
                    ))}
                </>
            ) : (
                <span className="text-muted-foreground">{placeholder}</span>
            )}
        </div>
    )
}
