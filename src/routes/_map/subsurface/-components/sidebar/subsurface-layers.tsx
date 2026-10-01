import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import {
  renderSubsurfaceLayerFilters,
  SUBSURFACE_FILTER_SCHEMAS,
} from './subsurface-layer-filters'
import { renderSubsurfaceLegend } from './subsurface-symbology-legend'

const hasLayerFilters = (title: string) => title in SUBSURFACE_FILTER_SCHEMAS

/**
 * Subsurface variant of the shared Layers sidebar. Identical layout but injects
 * per-layer filters (e.g. the UCRC Collection schema) into each layer's collapsible
 * Filters slot via the `layerExtrasRender` render-prop. Replaces the old
 * Map Configurations "UCRC Collection Filters" card.
 */
function SubsurfaceLayers({
  disableExport = false,
}: { disableExport?: boolean } = {}) {
  const { layerConfigs, isLoading } = useGetLayerConfigs('layers')
  const layerList = useCustomLayerList({
    config: layerConfigs,
    disableExport,
    hasLayerFilters,
    layerExtrasRender: renderSubsurfaceLayerFilters,
    layerLegendRender: renderSubsurfaceLegend,
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

export default SubsurfaceLayers
