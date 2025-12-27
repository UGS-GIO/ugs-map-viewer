import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type DrawMode = 'off' | 'rectangle' | 'polygon';

interface MultiSelectContextType {
  // Draw mode (rectangle/polygon drawing)
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;

  // Additive mode (shift+click toggle)
  additiveModeLocked: boolean;
  setAdditiveModeLocked: (locked: boolean) => void;

  // Drawing state
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  hasSelection: boolean;
  setHasSelection: (has: boolean) => void;

  // Popup suppression for additive mode
  suppressNextPopup: () => void;
  consumeSuppressPopup: () => boolean;
}

const MultiSelectContext = createContext<MultiSelectContextType | undefined>(undefined);

export function MultiSelectProvider({ children }: { children: ReactNode }) {
  const [drawMode, setDrawMode] = useState<DrawMode>('off');
  const [additiveModeLocked, setAdditiveModeLocked] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const suppressPopupRef = useRef(false);

  const suppressNextPopup = useCallback(() => {
    suppressPopupRef.current = true;
  }, []);

  const consumeSuppressPopup = useCallback(() => {
    const shouldSuppress = suppressPopupRef.current;
    suppressPopupRef.current = false;
    return shouldSuppress;
  }, []);

  return (
    <MultiSelectContext.Provider
      value={{
        drawMode,
        setDrawMode,
        additiveModeLocked,
        setAdditiveModeLocked,
        isDrawing,
        setIsDrawing,
        hasSelection,
        setHasSelection,
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
