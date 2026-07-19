import { BackToMenuButton } from '@/components/ui/back-to-menu-button'
import { useCustomLayerList } from '@/hooks/use-custom-layerlist'
import { useGetLayerConfigs } from '@/hooks/use-get-layer-configs'
import type { LayerProps, PMTilesLayerProps } from '@/lib/types/mapping-types'
import { isGroupLayer, isPMTilesLayer } from '@/lib/map/layer-utils'
import { LayerFilters } from './layer-filters'
import { layerPanelPlugin } from './layer-panels'

/**
 * Layers sidebar for /review-stac (auto-discovered review catalog layers).
 *
 * No layer is special-cased here. Every layer renders its declarative `filterFields` via the generic
 * <LayerFilters>, then — if it registered one — its plug-in's bespoke stats + legend. Displacement gets
 * its InSAR panel that way; a future bespoke layer just registers a plug-in.
 */
export function ReviewStacLayers() {
  const { layerConfigs, isLoading } = useGetLayerConfigs('review-stac')

  const find = (title: string) => findPMTilesByTitle(layerConfigs ?? [], title)

  const layerList = useCustomLayerList({
    config: layerConfigs,
    layerExtrasRender: (title) => {
      const layer = find(title)
      if (!layer) return null
      const plugin = layerPanelPlugin(layer)
      const stats = plugin?.renderStats?.(layer)
      if (!layer.filterFields?.length && !stats) return null
      return (
        <div className="flex flex-col">
          <LayerFilters layer={layer} />
          {stats && <div className="mt-1 border-t border-border/60 pt-2">{stats}</div>}
        </div>
      )
    },
    layerLegendRender: (title) => {
      const layer = find(title)
      return layer ? (layerPanelPlugin(layer)?.renderLegend?.(layer) ?? null) : null
    },
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

function findPMTilesByTitle(layers: LayerProps[], title: string): PMTilesLayerProps | undefined {
  for (const l of layers) {
    if (isGroupLayer(l) && l.layers) {
      const r = findPMTilesByTitle(l.layers, title)
      if (r) return r
    } else if (isPMTilesLayer(l) && l.title === title) {
      return l
    }
  }
  return undefined
}
