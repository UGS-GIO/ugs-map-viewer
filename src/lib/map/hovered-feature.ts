import { useSyncExternalStore } from 'react'
import type { HighlightFeature } from '@/components/maps/types'

// Module store, not state: hovering a result card repaints only the map's hover layer
let hovered: HighlightFeature | null = null
const listeners = new Set<() => void>()

export function setHoveredFeature(feature: HighlightFeature | null) {
  if (feature === hovered) return
  hovered = feature
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getHovered = () => hovered

export function useHoveredFeature() {
  return useSyncExternalStore(subscribe, getHovered, getHovered)
}
