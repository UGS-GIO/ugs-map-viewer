import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { isLandscapeLayer } from '../../-data/landscape-metrics'
import { LandscapeDataFilters } from './landscape-data-filters'
import { LandscapeDataLegend } from './landscape-data-legend'
import type { LayerProps } from '@/lib/types/mapping-types'

const hasLayerFilters = (title: string) => isLandscapeLayer(title)

const renderLayerExtras = (title: string, layer: LayerProps) => {
  if (isLandscapeLayer(title)) {
    return <LandscapeDataFilters layer={layer} />
  }
  return null
}

const renderLayerLegend = (layer: LayerProps) => {
  if (isLandscapeLayer(layer.title)) {
    return <LandscapeDataLegend layer={layer} />
  }
  return null
}

function WetlandsLayers({
  disableExport = false,
}: { disableExport?: boolean } = {}) {
  const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
  const layerList = useCustomLayerList({
    config: layerConfigs,
    disableExport,
    hasLayerFilters,
    layerExtrasRender: renderLayerExtras,
    layerLegendRender: renderLayerLegend,
  })

  if (isLoading) {
    return <div>Loading layers...</div>
  }

  return (
    <>
      <BackToMenuButton />
      <div
        key='layer-list'
        className='max-h-[calc(100vh)] overflow-y-visible'
        data-tour='layer-panel'
      >
        {layerList}
      </div>
    </>
  )
}

export default WetlandsLayers
