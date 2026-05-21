import { useMemo } from 'react'
import { hasRenderableContent, type LayerContentProps } from '@/components/maps/popups/types'
import { usePopupData, type UsePopupDataOptions } from './use-popup-data'

/**
 * Single source of truth for popup-renderable content. Wraps {@link usePopupData}
 * and applies the {@link hasRenderableContent} predicate as a hard filter so no
 * downstream consumer ever sees a layer card with empty features + empty
 * raster data. Sheet open/close, viewMode transitions, and pagination all
 * derive from this model — `hasAny` is the single predicate, no caller has to
 * recompute "is anything worth showing here" from raw `popupData.length`.
 */
export interface PopupModel {
  /** Renderable layer cards. Every entry is guaranteed `hasRenderableContent`. */
  cards: LayerContentProps[]
  /** Quick lookup by layer title. */
  byLayer: Map<string, LayerContentProps>
  /** True when at least one card is worth rendering. Use this for sheet open/close, not `cards.length`. */
  hasAny: boolean
  /** True while any raster query is in-flight. */
  isLoadingRaster: boolean
}

export function usePopupModel(opts: UsePopupDataOptions): PopupModel {
  const { popupData, isLoadingRaster } = usePopupData(opts)
  const cards = useMemo(() => popupData.filter(hasRenderableContent), [popupData])
  const byLayer = useMemo(() => new Map(cards.map(c => [c.layerTitle, c])), [cards])
  const hasAny = cards.length > 0
  return { cards, byLayer, hasAny, isLoadingRaster }
}
