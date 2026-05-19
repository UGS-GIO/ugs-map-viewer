/**
 * Single source of truth for the displacement contour layer titles and how each
 * maps to the `type` property value in the WFS source. Used by:
 *   - buildDisplacementLayerFilters: keys → cql_filter targets
 *   - DisplacementLayerCharts: title → type for per-layer scoping
 *   - DisplacementFiltersPanel: title-prefix check to gate filter visibility
 */
export const DISPLACEMENT_LAYER_TYPES = {
    'Displacement Contours - Cumulative': 'Cumulative',
    'Displacement Contours - Yearly': 'Yearly',
    'Displacement Contours - Vertical Displacement Rate': 'Vertical Displacement Rate',
    'Displacement Contours - Cumulative: Review': 'Cumulative',
    'Displacement Contours - Yearly: Review': 'Yearly',
    'Displacement Contours - Vertical Displacement Rate: Review': 'Vertical Displacement Rate',
} as const

export type DisplacementLayerTitle = keyof typeof DISPLACEMENT_LAYER_TYPES
export type DisplacementType = typeof DISPLACEMENT_LAYER_TYPES[DisplacementLayerTitle]

export function isDisplacementLayerTitle(title: string): title is DisplacementLayerTitle {
    return title in DISPLACEMENT_LAYER_TYPES
}

