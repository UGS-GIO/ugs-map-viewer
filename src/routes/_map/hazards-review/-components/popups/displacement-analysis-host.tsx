import { useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    DISPLACEMENT_LAYER_TYPES,
    isChartedType,
    isDisplacementLayerTitle,
    type DisplacementLayerTitle,
    type DisplacementType,
} from './displacement-layers'
import { useDisplacementAnalysis } from './displacement-analysis-context'
import { DisplacementLayerCharts } from './displacement-layer-charts'
import { DisplacementRateStats } from './displacement-rate-stats'

// The single, persistent analysis pop-out. Mounted once at the provider level
// (above the sidebar's surface-switch remount), so flipping surfaces inside it
// never tears it down. Owns the Dialog shell + the surface switch; the body is the
// active surface's stats component in `mode="analysis"`, keyed by title so each
// surface gets a clean instance (its own year/paging state) without closing the
// dialog. Kept in its own module so the stats components import only the layout,
// never this host — no import cycle.
//
// INDEPENDENT by design: the surface switch drives only this pop-out, not the
// sidebar/map selection — the pop-out is a standalone analysis workspace. The
// scope summary always names the surface shown, so it can't be mistaken for the
// map's. (To make it drive the map instead, have the switch call
// setExclusiveSelection and derive the active surface from the selection.)
//
// Tradeoff: while the pop-out is open AND the sidebar's Filters section is
// expanded behind it, that surface's stats compute in two instances (this one +
// the sidebar's). React Query dedupes the fetch, so it's CPU-only and situational
// — the accepted cost of hosting the dialog above the remount boundary.

// Fixed left→right order + short labels, mirroring the sidebar surface switch.
const SURFACE_ORDER: { type: DisplacementType; label: string }[] = [
    { type: 'Cumulative', label: 'Cumulative' },
    { type: 'Yearly', label: 'Yearly' },
    { type: 'Vertical Displacement Rate', label: 'Rate' },
]

// Sibling titles in the same naming family (plain vs ": Review") as the active
// title, so the switch stays within the surfaces this app actually configured.
//
// Assumes each family in DISPLACEMENT_LAYERS carries all three surfaces (true for
// the current config — the `isDisplacementLayerTitle` guard drops any that aren't).
// This is intentionally decoupled from the sidebar's variant group: the pop-out is a
// standalone analysis workspace, so its surface list is derived, not read from the
// group's selection. If the switch is ever made to drive the map (see the host's
// INDEPENDENT note), source the list from the variant group instead of guessing here.
function siblingTitles(activeTitle: DisplacementLayerTitle): { type: DisplacementType; label: string; title: DisplacementLayerTitle }[] {
    const suffix = activeTitle.endsWith(': Review') ? ': Review' : ''
    const out: { type: DisplacementType; label: string; title: DisplacementLayerTitle }[] = []
    for (const { type, label } of SURFACE_ORDER) {
        const candidate = `Displacement Contours - ${type}${suffix}`
        if (isDisplacementLayerTitle(candidate)) out.push({ type, label, title: candidate })
    }
    return out
}

function SurfaceSwitch({
    siblings, activeTitle, onSelect,
}: {
    siblings: { type: DisplacementType; label: string; title: DisplacementLayerTitle }[]
    activeTitle: DisplacementLayerTitle
    onSelect: (title: DisplacementLayerTitle) => void
}) {
    const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
    const activeIdx = siblings.findIndex(s => s.title === activeTitle)

    // Full WAI-ARIA radiogroup roving: both arrow axes wrap, Home/End jump to ends.
    const onKeyDown = (e: React.KeyboardEvent) => {
        let next: number
        switch (e.key) {
            case 'ArrowRight': case 'ArrowDown': next = (activeIdx + 1) % siblings.length; break
            case 'ArrowLeft': case 'ArrowUp': next = (activeIdx - 1 + siblings.length) % siblings.length; break
            case 'Home': next = 0; break
            case 'End': next = siblings.length - 1; break
            default: return
        }
        e.preventDefault()
        onSelect(siblings[next].title)
        btnRefs.current[next]?.focus()
    }

    return (
        <div role="radiogroup" aria-label="Displacement surface" className="inline-flex rounded-md border border-border bg-muted/40 p-0.5" onKeyDown={onKeyDown}>
            {siblings.map((s, i) => {
                const active = s.title === activeTitle
                return (
                    <button
                        key={s.title}
                        ref={el => { btnRefs.current[i] = el }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSelect(s.title)}
                        className={`rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {s.label}
                    </button>
                )
            })}
        </div>
    )
}

export function DisplacementAnalysisHost() {
    const { open, activeTitle, setActiveTitle, closeAnalysis } = useDisplacementAnalysis()

    // Nothing to render until a surface has been chosen (first Expand click).
    if (!activeTitle) return null
    const type = DISPLACEMENT_LAYER_TYPES[activeTitle]
    const siblings = siblingTitles(activeTitle)

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) closeAnalysis() }}>
            {/* Description is rendered inside the layout body (the scope summary), so
                tell Radix there's no header description rather than warning. */}
            <DialogContent aria-describedby={undefined} className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <DialogTitle className="text-base font-semibold">Displacement (InSAR)</DialogTitle>
                        {siblings.length > 1 && (
                            <SurfaceSwitch siblings={siblings} activeTitle={activeTitle} onSelect={setActiveTitle} />
                        )}
                    </div>
                </DialogHeader>

                {/* key={activeTitle}: a clean stats instance per surface (no stale
                    year/paging state) while the Dialog above stays mounted/open. */}
                {isChartedType(type) ? (
                    <DisplacementLayerCharts key={activeTitle} typeValue={type} layerTitle={activeTitle} mode="analysis" />
                ) : (
                    <DisplacementRateStats key={activeTitle} layerTitle={activeTitle} mode="analysis" />
                )}
            </DialogContent>
        </Dialog>
    )
}
