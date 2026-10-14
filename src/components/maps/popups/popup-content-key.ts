import type { LayerContentProps } from './types'

/** Changes when the set of layers in the popup changes, so its pagination starts over. */
export function popupContentKey(popupContent: LayerContentProps[]): string {
  return popupContent.map((item) => `${item.groupLayerTitle}-${item.layerTitle}`).join('|')
}
