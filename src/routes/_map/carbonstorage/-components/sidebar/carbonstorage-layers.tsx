import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { renderCarbonStorageLegend } from './carbonstorage-symbology-legend'

/**
 * Carbon storage variant of the shared Layers sidebar. Identical layout but wires the
 * Power Plants layer's interactive, STAC-derived checkbox legend via the
 * `layerLegendRender` render-prop. Mirrors subsurface's UCRC wiring.
 */
function CarbonStorageLayers({ disableExport = false }: { disableExport?: boolean } = {}) {
    const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
    const layerList = useCustomLayerList({
        config: layerConfigs,
        disableExport,
        layerLegendRender: renderCarbonStorageLegend,
    })

    if (isLoading) {
        return <div>Loading layers...</div>
    }

    return (
        <>
            <BackToMenuButton />
            <div key='layer-list' className='overflow-y-visible max-h-[calc(100vh)]' data-tour="layer-panel">
                {layerList}
            </div>
        </>
    )
}

export default CarbonStorageLayers
