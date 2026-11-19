/**
 * Filter state for the /review-stac page: per-layer field values, keyed by layer title. The sidebar
 * Filters slot writes here; the map derives vectorLayerFilters from it. Same pattern a config-based app
 * would use — nothing STAC-specific.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { FieldValue, FilterValues } from '@/lib/map/layer-filters';

interface ReviewFilterContextValue {
  values: Record<string, FilterValues>; // layerTitle -> { field -> value }
  setFieldValue: (layerTitle: string, field: string, value: FieldValue | undefined) => void;
}

const ReviewFilterContext = createContext<ReviewFilterContextValue | null>(null);

export function ReviewFilterProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, FilterValues>>({});

  const setFieldValue = useCallback((layerTitle: string, field: string, value: FieldValue | undefined) => {
    setValues((prev) => {
      const layer: FilterValues = { ...(prev[layerTitle] ?? {}) };
      if (value == null) delete layer[field];
      else layer[field] = value;
      return { ...prev, [layerTitle]: layer };
    });
  }, []);

  return (
    <ReviewFilterContext.Provider value={{ values, setFieldValue }}>{children}</ReviewFilterContext.Provider>
  );
}

export function useReviewFilters(): ReviewFilterContextValue {
  const ctx = useContext(ReviewFilterContext);
  if (!ctx) throw new Error('useReviewFilters must be used within ReviewFilterProvider');
  return ctx;
}
