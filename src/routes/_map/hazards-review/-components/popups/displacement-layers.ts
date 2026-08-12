/**
 * Single source of truth for displacement layers used by the data-reviewer
 * popup + sidebar widgets. One place to update when the WFS source rename
 * lands, when GeoServer style names change, or when new displacement types
 * appear.
 */

// Fully-qualified WFS feature type name backing every displacement layer.
export const DISPLACEMENT_TYPE_NAME = 'hazards:hazards_displacement_contours_review'

// Title of the layer-tree group containing all displacement layers. Used by
// HazardsReviewLayers to attach the group-level filter slot.
export const LAND_SUBSIDENCE_GROUP_TITLE = 'Land Subsidence'

interface DisplacementLayerEntry {
    type: DisplacementTypeValue
    styleName: string
}

type DisplacementTypeValue = 'Cumulative' | 'Yearly' | 'Vertical Displacement Rate'

// Per-title metadata: the `type` cql value to filter the merged source by, and
// the GeoServer SLD that styles the layer's tiles (mirrored to the layer-list
// legend via WMSLayerProps.styleName).
export const DISPLACEMENT_LAYERS = {
    'Displacement Contours - Cumulative': { type: 'Cumulative', styleName: 'hazards_insar_displacement_cumulative' },
    'Displacement Contours - Yearly': { type: 'Yearly', styleName: 'hazards_insar_displacement_yearly' },
    'Displacement Contours - Vertical Displacement Rate': { type: 'Vertical Displacement Rate', styleName: 'hazards_insar_displacement_velocity' },
    'Displacement Contours - Cumulative: Review': { type: 'Cumulative', styleName: 'hazards_insar_displacement_cumulative' },
    'Displacement Contours - Yearly: Review': { type: 'Yearly', styleName: 'hazards_insar_displacement_yearly' },
    'Displacement Contours - Vertical Displacement Rate: Review': { type: 'Vertical Displacement Rate', styleName: 'hazards_insar_displacement_velocity' },
} as const satisfies Record<string, DisplacementLayerEntry>

export type DisplacementLayerTitle = keyof typeof DISPLACEMENT_LAYERS
export type DisplacementType = typeof DISPLACEMENT_LAYERS[DisplacementLayerTitle]['type']

export function isDisplacementLayerTitle(title: string): title is DisplacementLayerTitle {
    return title in DISPLACEMENT_LAYERS
}

// Convenience accessors derived from DISPLACEMENT_LAYERS so callers don't carry
// their own duplicate maps.
export const DISPLACEMENT_LAYER_TYPES: Record<DisplacementLayerTitle, DisplacementType> = Object.fromEntries(
    (Object.entries(DISPLACEMENT_LAYERS) as [DisplacementLayerTitle, DisplacementLayerEntry][])
        .map(([title, entry]) => [title, entry.type])
) as Record<DisplacementLayerTitle, DisplacementType>

export const DISPLACEMENT_LAYER_STYLES: Record<DisplacementLayerTitle, string> = Object.fromEntries(
    (Object.entries(DISPLACEMENT_LAYERS) as [DisplacementLayerTitle, DisplacementLayerEntry][])
        .map(([title, entry]) => [title, entry.styleName])
) as Record<DisplacementLayerTitle, string>

export function getStyleNameForType(type: DisplacementType): string | undefined {
    for (const entry of Object.values(DISPLACEMENT_LAYERS) as DisplacementLayerEntry[]) {
        if (entry.type === type) return entry.styleName
    }
    return undefined
}

// Types whose features carry per-year value_inches and have year-driven analytics.
// Anything outside this set renders on the map but doesn't get a chart card or
// threshold input — `Vertical Displacement Rate` for example is a multi-year
// period summary, not a per-year quantity.
export const CHARTED_TYPES = ['Cumulative', 'Yearly'] as const
export type ChartedType = typeof CHARTED_TYPES[number]

export function isChartedType(t: DisplacementType): t is ChartedType {
    return (CHARTED_TYPES as readonly string[]).includes(t)
}

// Human-readable units for each type's value_inches column. Cumulative + VDR
// readings span a window (start_date → end_date) so the unit reads "per time
// period"; Yearly is a per-year measurement, so the unit is unqualified.
// Surfaced on the sidebar legend (via WMSLayerProps.legendUnit) and the chart
// legend caption so reviewers see one consistent unit string everywhere.
const DISPLACEMENT_UNITS_LABEL: Record<DisplacementType, string> = {
    'Cumulative': 'inches of vertical displacement per time period',
    'Yearly': 'inches of vertical displacement',
    'Vertical Displacement Rate': 'in/year',
}

export function getUnitsLabelForType(type: DisplacementType): string {
    return DISPLACEMENT_UNITS_LABEL[type]
}

// Canonical data-quality categories, best→worst, used to order the data-quality
// filter checkboxes. The filter itself works off whatever values are present in
// the data (NOT IN excluded), so a new backend category still shows by default —
// it just won't be sorted until added here.
export const DATA_QUAL_ORDER = ['high', 'medium', 'low', 'very low', 'unknown'] as const

// Categories shown by default. Reviewers start scoped to trustworthy data;
// everything below medium is excluded until they opt back in. "Reset" returns
// to this set, not to all-visible.
export const DEFAULT_VISIBLE_DATA_QUALS = ['high', 'medium'] as const

// What each data-quality category means: share of valid pixels behind the
// measurement. Surfaced under each data-quality checkbox. Keyed by the same
// lowercase tokens as DATA_QUAL_ORDER; categories without an entry (e.g.
// 'unknown') render no description.
export const DATA_QUAL_DESCRIPTIONS: Record<string, string> = {
    'high': '≥ 80% of pixels valid',
    'medium': '60–79% of pixels valid',
    'low': '40–59% of pixels valid',
    'very low': '< 40% of pixels valid',
}

// Default exclusion set = every known category that isn't visible by default.
// Stored as exclusions to match excludedDataQualsByType's "store what's hidden"
// model. Categories absent from a given type's data are harmless extras here.
export const DEFAULT_EXCLUDED_DATA_QUALS: readonly string[] =
    DATA_QUAL_ORDER.filter(q => !(DEFAULT_VISIBLE_DATA_QUALS as readonly string[]).includes(q))
