import { useState, useCallback } from 'react'
import type { ClickedFeature, HighlightFeature } from '@/components/maps/types'

interface UseFeatureSelectionOptions {
  onHighlightChange?: (features: HighlightFeature[]) => void
  onSelectionChange?: (features: ClickedFeature[]) => void
}

// Helper to convert ClickedFeatures to HighlightFeatures
function toHighlightFeatures(features: ClickedFeature[]): HighlightFeature[] {
  return features
    .filter(f => f.geometry)
    .map(f => ({
      id: f.id as string | number,
      geometry: f.geometry!,
      properties: f.properties || {}
    }))
}

// Create a unique key for deduplication (layer + ogc_fid is more reliable than WFS feature ID)
function getFeatureKey(f: ClickedFeature): string {
  const ogcFid = f.properties?.ogc_fid ?? f.id
  return `${f.layerTitle || ''}:${ogcFid}`
}

/**
 * Hook to manage feature selection state and handlers
 * Encapsulates selection logic including click handling, layer removal, and clearing
 */
export function useFeatureSelection({
  onHighlightChange,
  onSelectionChange,
}: UseFeatureSelectionOptions) {
  const [selectedFeatures, setSelectedFeatures] = useState<ClickedFeature[]>([])

  // Handle layer turned off - remove features from that layer
  const handleLayerTurnedOff = useCallback((layerTitle: string) => {
    setSelectedFeatures(prev => {
      const remaining = prev.filter(f => f.layerTitle !== layerTitle)
      if (remaining.length === prev.length) return prev

      onHighlightChange?.(toHighlightFeatures(remaining))
      onSelectionChange?.(remaining)

      return remaining
    })
  }, [onHighlightChange, onSelectionChange])

  // Handle feature click
  const handleFeatureClick = useCallback((features: ClickedFeature[], options?: { additive?: boolean }) => {
    // Clear highlights when clearing selection (non-additive with no features)
    if (!options?.additive && features.length === 0) {
      onHighlightChange?.([])
      setSelectedFeatures([])
      return
    }

    // Calculate new selection
    setSelectedFeatures(prev => {
      let newSelection: ClickedFeature[]
      let selectionChanged = false

      if (options?.additive && features.length > 0) {
        // Additive: merge with existing, filtering out duplicates by layer+ogc_fid
        const existingKeys = new Set(prev.map(getFeatureKey))
        const newFeatures = features.filter(f => !existingKeys.has(getFeatureKey(f)))
        if (newFeatures.length > 0) {
          newSelection = [...prev, ...newFeatures]
          selectionChanged = true
        } else {
          // No new features - keep existing selection unchanged
          return prev
        }
      } else {
        // Replace selection
        newSelection = features.length > 0 ? features : []
        selectionChanged = true
      }

      // Only update highlights when selection actually changed
      if (selectionChanged && newSelection.length > 0) {
        if (options?.additive) {
          onHighlightChange?.(toHighlightFeatures(newSelection))
        } else {
          // Highlight first feature with geometry
          const firstWithGeometry = newSelection.find(f => f.geometry)
          onHighlightChange?.(firstWithGeometry ? toHighlightFeatures([firstWithGeometry]) : [])
        }
      }

      return newSelection
    })
  }, [onHighlightChange])

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    onHighlightChange?.([])
    setSelectedFeatures([])
  }, [onHighlightChange])

  return {
    selectedFeatures,
    setSelectedFeatures,
    handleFeatureClick,
    handleLayerTurnedOff,
    clearAllSelections,
  }
}
