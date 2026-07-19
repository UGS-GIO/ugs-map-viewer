import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import { LayerFiltersByTitle } from './layer-filters'
import { renderDisplacementLayerPanel } from '@/routes/_map/hazards-review/-components/popups/displacement-layer-panel'
import { renderDisplacementLegend } from '@/routes/_map/hazards-review/-components/popups/displacement-legend'

/**
 * Layers sidebar for /review-stac. Auto-discovered review catalog layers. Displacement type-layers get
 * the full InSAR filter+stats panel (fed by the review geoparquet); other layers get the generic
 * <LayerFilters> from their declared filterFields.
 */
export function ReviewStacLayers() {
  const { layerConfigs, isLoading } = useGetLayerConfigs('review-stac')
  const layerList = useCustomLayerList({
    config: layerConfigs,
    layerExtrasRender: (title) =>
      renderDisplacementLayerPanel(title) ?? <LayerFiltersByTitle title={title} config={layerConfigs ?? []} />,
    layerLegendRender: (title) => renderDisplacementLegend(title),
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
