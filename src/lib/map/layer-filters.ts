/**
 * Layer-level vector filters — transferable across auto-discovered (/review-stac) and config-based apps.
 *
 * A layer declares `filterFields` (on PMTilesLayerProps). The generic <LayerFilters> UI reads them,
 * `buildFilterExpression` turns the user's values into a MapLibre FilterSpecification, and that goes into
 * GenericMapContainer's `vectorLayerFilters` (keyed by layer title) → applied via setFilter. None of it
 * is /review-stac-specific: a config-based layer just puts `filterFields` on its own config instead of
 * getting them from the registry below.
 */
import type { FilterSpecification } from 'maplibre-gl';
import type { FilterFieldSpec } from '@/lib/types/mapping-types';

// Auto-discovery registry: filter declarations by STAC item id. This is the config surface for the STAC
// routes (a config-based app declares filterFields directly on its layer config instead). Prototype:
// displacement contours. Enum values / range bounds are tuned here.
const FILTER_REGISTRY: Record<string, FilterFieldSpec[]> = {
  hazards_displacement_contours: [
    { field: 'type', label: 'Displacement type', kind: 'enum', values: ['Cumulative', 'Yearly', 'Vertical Displacement Rate'] },
    { field: 'year', label: 'Year', kind: 'number-range', min: 2015, max: 2025, step: 1 },
  ],
};

export function filterFieldsForItem(itemId: string): FilterFieldSpec[] | undefined {
  return FILTER_REGISTRY[itemId];
}

// Per-field values: enum -> selected string[]; range -> [min, max].
export type FieldValue = string[] | [number, number];
export type FilterValues = Record<string, FieldValue>;

/** Build a MapLibre filter from the specs + current values. undefined = no filter (show everything). */
export function buildFilterExpression(
  specs: FilterFieldSpec[],
  values: FilterValues,
): FilterSpecification | undefined {
  const clauses: unknown[] = [];
  for (const spec of specs) {
    const v = values[spec.field];
    if (v == null) continue;
    if (spec.kind === 'enum') {
      const sel = v as string[];
      // only constrain when a strict, non-empty subset is selected
      if (sel.length > 0 && sel.length < spec.values.length) {
        clauses.push(['match', ['coalesce', ['get', spec.field], ''], sel, true, false]);
      }
    } else {
      const [lo, hi] = v as [number, number];
      const num = ['to-number', ['get', spec.field]];
      if (lo > spec.min) clauses.push(['>=', num, lo]);
      if (hi < spec.max) clauses.push(['<=', num, hi]);
    }
  }
  if (clauses.length === 0) return undefined;
  return ['all', ...clauses] as unknown as FilterSpecification;
}
