import { useState, useCallback } from 'react'
import type { ClickedFeature, HighlightFeature } from '@/components/maps/types'
import type { PopupSheetRef } from '@/components/maps/popups/popup-sheet'
import type { ViewMode } from '@/hooks/use-map-url-sync'

interface FeatureRef {
  layer: string
  id: string
}

interface UseFeatureSelectionOptions {
  viewMode: ViewMode
  selectedFeatureRefs: FeatureRef[]
  setSelectedFeatureRefs: (refs: FeatureRef[]) => void
  setClickBufferBounds: (bounds: { sw: [number, number]; ne: [number, number] } | null) => void
  setFeatureBbox: (bbox: { sw: [number, number]; ne: [number, number] } | null) => void
  popupSheetRef: React.RefObject<PopupSheetRef | null>
  onHighlightChange?: (features: HighlightFeature[]) => void
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
  viewMode: _viewMode,
  selectedFeatureRefs: _selectedFeatureRefs,
  setSelectedFeatureRefs,
  setClickBufferBounds,
  setFeatureBbox,
  popupSheetRef: _popupSheetRef,
  onHighlightChange,
}: UseFeatureSelectionOptions) {
  // viewMode + popupSheetRef are kept in the contract for back-compat with
  // existing call sites — the imperative sheet-open path they enabled is gone
  // now that sheet visibility is reactive on the popup model in the parent.
  // selectedFeatureRefs is available for future URL-restoration highlighting.
  const [selectedFeatures, setSelectedFeatures] = useState<ClickedFeature[]>([])

  // Handle layer turned off - remove features from that layer
  const handleLayerTurnedOff = useCallback((layerTitle: string) => {
    setSelectedFeatures(prev => {
      const remaining = prev.filter(f => f.layerTitle !== layerTitle)
      if (remaining.length === prev.length) return prev

      // Update URL refs
      const remainingRefs = remaining.map(f => ({
        layer: f.layerTitle || '',
        id: String(f.id),
      }))
      setSelectedFeatureRefs(remainingRefs)

      // Update highlights declaratively
      onHighlightChange?.(toHighlightFeatures(remaining))

      // If no features remain, clear URL state
      if (remaining.length === 0) {
        setFeatureBbox(null)
      }

      return remaining
    })
  }, [setSelectedFeatureRefs, setFeatureBbox, onHighlightChange])

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

    // Sheet open is reactive in the parent (popup model + dismissal flag);
    // no imperative open needed here. Pull viewMode out of the deps since it
    // no longer participates in the body.
  }, [onHighlightChange])

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    onHighlightChange?.([])
    setSelectedFeatures([])
    setClickBufferBounds(null)
    setFeatureBbox(null)
    setSelectedFeatureRefs([])
  }, [setClickBufferBounds, setFeatureBbox, setSelectedFeatureRefs, onHighlightChange])

  return {
    selectedFeatures,
    setSelectedFeatures,
    handleFeatureClick,
    handleLayerTurnedOff,
    clearAllSelections,
  }
}
