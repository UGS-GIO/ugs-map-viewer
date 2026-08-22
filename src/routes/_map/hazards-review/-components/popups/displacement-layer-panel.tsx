import { renderDisplacementLayerFilters } from './displacement-layer-filters'
import { renderDisplacementLayerStats } from './displacement-layer-charts'
import { DisplacementRateStats } from './displacement-rate-stats'
import { DISPLACEMENT_LAYER_TYPES, isDisplacementLayerTitle } from './displacement-layers'

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
        ? <DisplacementRateStats />
        : renderDisplacementLayerStats(layerTitle)
    if (!filters && !stats) return null
    return (
        <div className="flex flex-col">
            {filters}
            {stats && <div className="mt-1 border-t border-border/60 pt-2">{stats}</div>}
        </div>
    )
}
