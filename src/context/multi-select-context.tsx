import { createContext, useContext, useState, ReactNode } from 'react';

interface MultiSelectContextType {
  isMultiSelectMode: boolean;
  setMultiSelectMode: (enabled: boolean) => void;
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  hasCompletedPolygon: boolean;
  setHasCompletedPolygon: (completed: boolean) => void;
}

const MultiSelectContext = createContext<MultiSelectContextType | undefined>(undefined);

export function MultiSelectProvider({ children }: { children: ReactNode }) {
  const [isMultiSelectMode, setMultiSelectMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasCompletedPolygon, setHasCompletedPolygon] = useState(false);

  return (
    <MultiSelectContext.Provider
      value={{
        isMultiSelectMode,
        setMultiSelectMode,
        isDrawing,
        setIsDrawing,
        hasCompletedPolygon,
        setHasCompletedPolygon,
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
