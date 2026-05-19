import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { renderDisplacementLayerFilters } from '../popups/displacement-layer-filters'
import { renderDisplacementLayerStats } from '../popups/displacement-layer-charts'

/**
 * Hazards-review variant of the shared Layers sidebar. Identical layout but
 * injects per-layer subsidence filters (Water Year for Yearly; threshold for
 * Cumulative + Yearly; nothing for Vertical Displacement Rate) inside each
 * displacement layer's collapsible Filters slot.
 */
export function HazardsReviewLayers() {
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
    const layerList = useCustomLayerList({
        config: layerConfigs,
        layerExtrasRender: renderDisplacementLayerFilters,
        layerStatsRender: renderDisplacementLayerStats,
    })

    if (isLoading) {
        return <div>Loading layers...</div>
    }

    return (
        <>
            <BackToMenuButton />
            <div className="overflow-y-visible max-h-[calc(100vh)]" data-tour="layer-panel">
                {layerList}
            </div>
        </>
    )
}
