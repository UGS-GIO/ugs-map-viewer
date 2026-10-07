import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import {
  renderWetlandPlantsLayerFilters,
  WETLANDPLANTS_FILTER_SCHEMAS,
} from './wetlandplants-layer-filters'
import { renderWetlandPlantsLegend } from './wetlandplants-symbology-legend'

const hasLayerFilters = (title: string) => title in WETLANDPLANTS_FILTER_SCHEMAS

function WetlandPlantsLayers({
  disableExport = false,
}: { disableExport?: boolean } = {}) {
  const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
  const layerList = useCustomLayerList({
    config: layerConfigs,
    disableExport,
    hasLayerFilters,
    layerExtrasRender: renderWetlandPlantsLayerFilters,
    layerLegendRender: renderWetlandPlantsLegend,
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

export default WetlandPlantsLayers
