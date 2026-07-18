import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { LayerFiltersByTitle } from './layer-filters'

/**
 * Layers sidebar for /review-stac. The layer tree is the auto-discovered review STAC catalog
 * (useGetLayerConfigs('review-stac')). Layers that declare filterFields get a generic Filters slot.
 */
export function ReviewStacLayers() {
  const { layerConfigs, isLoading } = useGetLayerConfigs('review-stac')
  const layerList = useCustomLayerList({
    config: layerConfigs,
    layerExtrasRender: (title) => <LayerFiltersByTitle title={title} config={layerConfigs ?? []} />,
  })

  if (isLoading) {
    return <div className="p-2 text-sm text-muted-foreground">Loading review layers…</div>
  }

  return (
    <>
      <BackToMenuButton />
      <div className="max-h-[calc(100vh)] overflow-y-visible" data-tour="layer-panel">
        {layerList}
      </div>
    </>
  )
}
