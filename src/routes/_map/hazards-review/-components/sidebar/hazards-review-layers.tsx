import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { renderDisplacementLayerPanel } from '../popups/displacement-layer-panel'

/**
 * Hazards-review variant of the shared Layers sidebar. Identical layout but
 * injects a combined filters + stats panel (basin/year/data-quality/threshold
 * controls plus the KPI/chart/basin-list stats — ALL-4819) inside each
 * displacement layer's collapsible Filters slot. Nothing is passed for
 * layerStatsRender any more: the Stats toggle disappears and everything lives
 * behind the single Filters toggle.
 */
export function HazardsReviewLayers() {
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
    const layerList = useCustomLayerList({
        config: layerConfigs,
        layerExtrasRender: renderDisplacementLayerPanel,
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
