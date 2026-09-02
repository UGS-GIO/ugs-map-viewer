import { Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { renderDisplacementLayerFilters } from './displacement-layer-filters'
import { renderDisplacementLayerStats } from './displacement-layer-charts'
import { DisplacementRateStats } from './displacement-rate-stats'
import { useDisplacementAnalysis } from './displacement-analysis-context'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle } from './displacement-layers'

// "Expand" is a panel-level action (it pops the WHOLE panel into the wide analysis
// view), so it sits at the very top of the panel — above the filter controls and
// stats — rather than beside any one chart. Its own component so it can call the
// analysis context hook (the panel entry below is a plain render function).
function PanelExpandButton({ layerTitle }: { layerTitle: string }) {
    const { openAnalysis } = useDisplacementAnalysis()
    if (!isDisplacementLayerTitle(layerTitle)) return null
    return (
        <div className="flex justify-end px-2 pt-1">
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => openAnalysis(layerTitle)}>
                Expand <Maximize2 className="h-3 w-3" aria-hidden="true" />
            </Button>
        </div>
    )
}

// Combined Filters + Stats panel for displacement layers (ALL-4819). Sits
// behind LayerControls' single "Filters" toggle so reviewers get basin/year/
// data-quality/threshold controls and the KPI + chart + basin-list stats in
// one panel instead of two separately-toggled ones. Composes the two existing
// public render functions rather than merging their internals, so each stays
// independently testable/reusable.
export function renderDisplacementLayerPanel(layerTitle: string): React.ReactNode {
    if (!isDisplacementLayerTitle(layerTitle)) return null
    const filters = renderDisplacementLayerFilters(layerTitle)
    // Rate is a velocity snapshot — a lean KPI + basin-rate ranking, not the
    // time-series stats the charted (Cumulative/Yearly) surfaces get.
    const stats = DISPLACEMENT_LAYER_TYPES[layerTitle] === 'Vertical Displacement Rate'
        ? <DisplacementRateStats layerTitle={layerTitle} />
        : renderDisplacementLayerStats(layerTitle)
    if (!filters && !stats) return null
    return (
        <div className="flex flex-col">
            <PanelExpandButton layerTitle={layerTitle} />
            {filters}
            {stats && <div className="mt-1 border-t border-border/60 pt-2">{stats}</div>}
        </div>
    )
}
