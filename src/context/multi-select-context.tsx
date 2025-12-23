import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { Feature } from 'geojson';

export type SelectionMode = 'click' | 'polygon';

interface MultiSelectContextType {
  // Selection tool state
  isMultiSelectMode: boolean;
  setMultiSelectMode: (enabled: boolean) => void;
  selectionMode: SelectionMode;
  setSelectionMode: (mode: SelectionMode) => void;

  // Polygon drawing state
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  hasCompletedPolygon: boolean;
  setHasCompletedPolygon: (completed: boolean) => void;

  // Selected features (for click-to-select mode)
  selectedFeatures: Feature[];
  addSelectedFeature: (feature: Feature) => void;
  removeSelectedFeature: (featureId: string | number) => void;
  clearSelectedFeatures: () => void;
  isFeatureSelected: (featureId: string | number) => boolean;

  // Popup suppression for shift+click
  suppressNextPopup: () => void;
  consumeSuppressPopup: () => boolean;
}

const MultiSelectContext = createContext<MultiSelectContextType | undefined>(undefined);

export function MultiSelectProvider({ children }: { children: ReactNode }) {
  const [isMultiSelectMode, setMultiSelectMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('click');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasCompletedPolygon, setHasCompletedPolygon] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<Feature[]>([]);
  const suppressPopupRef = useRef(false);

  // Set flag to suppress next popup (for shift+click)
  const suppressNextPopup = useCallback(() => {
    suppressPopupRef.current = true;
  }, []);

  // Check and consume the suppress flag (returns true if should suppress)
  const consumeSuppressPopup = useCallback(() => {
    const shouldSuppress = suppressPopupRef.current;
    suppressPopupRef.current = false;
    return shouldSuppress;
  }, []);

  const addSelectedFeature = useCallback((feature: Feature) => {
    setSelectedFeatures(prev => {
      // Don't add if already selected
      if (prev.some(f => f.id === feature.id)) return prev;
      return [...prev, feature];
    });
  }, []);

  const removeSelectedFeature = useCallback((featureId: string | number) => {
    setSelectedFeatures(prev => prev.filter(f => f.id !== featureId));
  }, []);

  const clearSelectedFeatures = useCallback(() => {
    setSelectedFeatures([]);
  }, []);

  const isFeatureSelected = useCallback((featureId: string | number) => {
    return selectedFeatures.some(f => f.id === featureId);
  }, [selectedFeatures]);

  return (
    <MultiSelectContext.Provider
      value={{
        isMultiSelectMode,
        setMultiSelectMode,
        selectionMode,
        setSelectionMode,
        isDrawing,
        setIsDrawing,
        hasCompletedPolygon,
        setHasCompletedPolygon,
        selectedFeatures,
        addSelectedFeature,
        removeSelectedFeature,
        clearSelectedFeatures,
        isFeatureSelected,
        suppressNextPopup,
        consumeSuppressPopup,
      }}
    >
      {children}
    </MultiSelectContext.Provider>
  );
}

export function useMultiSelect() {
  const context = useContext(MultiSelectContext);
  if (!context) {
    throw new Error('useMultiSelect must be used within MultiSelectProvider');
  }
  return context;
}
