import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'

/**
 * Layers sidebar for /review-stac. The layer tree is the auto-discovered review STAC catalog
 * (useGetLayerConfigs('review-stac')) — no static per-page config, no displacement extras.
 */
export function ReviewStacLayers() {
  const { layerConfigs, isLoading } = useGetLayerConfigs('review-stac')
  const layerList = useCustomLayerList({ config: layerConfigs })

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
