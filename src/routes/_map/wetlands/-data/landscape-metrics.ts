export const LANDSCAPE_GROUP_TITLE = 'Landscape Ecoregion Data'

export const HUC12_ECO_TITLE = 'Watershed (HUC12) by Ecoregion'
export const HUC12_TITLE = 'Watershed (HUC12)'
export const HUC8_ECO_TITLE = 'Sub-Basin (HUC8) by Ecoregion'
export const HUC8_TITLE = 'Sub-Basin (HUC8)'
export const ECOREGION_TITLE = 'Ecoregion'

export const LANDSCAPE_SCALES = [
  { value: HUC12_ECO_TITLE, label: 'HUC12 by Ecoregion', stacItemId: 'wetlands_watershed_huc12_ecoregion' },
  { value: HUC12_TITLE, label: 'HUC12', stacItemId: 'wetlands_watershed_huc12' },
  { value: HUC8_ECO_TITLE, label: 'HUC8 by Ecoregion', stacItemId: 'wetlands_subbasin_huc8_ecoregion' },
  { value: HUC8_TITLE, label: 'HUC8', stacItemId: 'wetlands_subbasin_huc8' },
  { value: ECOREGION_TITLE, label: 'Ecoregion', stacItemId: 'wetlands_ecoregion' },
] as const

export const LANDSCAPE_LAYER_TITLES = LANDSCAPE_SCALES.map((s) => s.value)

export function isLandscapeLayer(title?: string): boolean {
  return !!title && (LANDSCAPE_LAYER_TITLES as readonly string[]).includes(title)
}

export function getStacItemIdForScale(title: string): string | undefined {
  return LANDSCAPE_SCALES.find((s) => s.value === title)?.stacItemId
}

export interface LandscapeMetric {
  value: string
  label: string
  category: string
  unit?: string
  isCategorical?: boolean
  allowedLayers?: readonly string[]
}

export const LANDSCAPE_METRICS: LandscapeMetric[] = [
  // General & Mapping Currency
  { value: 'utah_percent', label: 'Area in Utah (%)', category: 'General', unit: '%' },
  { value: 'outdated_mapping_percent', label: 'Outdated Wetland Mapping (%)', category: 'General', unit: '%' },
  { value: 'hr2000s_mapping_percent', label: 'Wetland Mapping 2000-2009 (%)', category: 'General', unit: '%' },
  { value: 'hr2010s_mapping_percent', label: 'Wetland Mapping 2010-2019 (%)', category: 'General', unit: '%' },
  { value: 'restorable_wetland_on_ag', label: 'Restorable Wetlands on Agricultural Lands (%)', category: 'General', unit: '%' },

  // Wetland Counts
  { value: 'riverine_count', label: 'Rivers, Channels, and Bars (#)', category: 'Wetland Counts', unit: '#' },
  { value: 'lake_count', label: 'Lakes (#)', category: 'Wetland Counts', unit: '#' },
  { value: 'pond_count', label: 'Ponds (#)', category: 'Wetland Counts', unit: '#' },
  { value: 'shore_count', label: 'Shores, Salt Flats, and Unvegetated Wetlands (#)', category: 'Wetland Counts', unit: '#' },
  { value: 'woody_count', label: 'Woody Wetlands (#)', category: 'Wetland Counts', unit: '#' },
  { value: 'emergent_count', label: 'Emergent Wetlands (#)', category: 'Wetland Counts', unit: '#' },

  // Wetland Areas
  { value: 'riverine_area', label: 'Rivers, Channels, and Bars (ha)', category: 'Wetland Areas', unit: 'ha' },
  { value: 'lake_area', label: 'Lakes (ha)', category: 'Wetland Areas', unit: 'ha' },
  { value: 'pond_area', label: 'Ponds (ha)', category: 'Wetland Areas', unit: 'ha' },
  { value: 'shore_area', label: 'Shores, Salt Flats, and Unvegetated Wetlands (ha)', category: 'Wetland Areas', unit: 'ha' },
  { value: 'woody_area', label: 'Woody Wetlands (ha)', category: 'Wetland Areas', unit: 'ha' },
  { value: 'emergent_area', label: 'Emergent Wetlands (ha)', category: 'Wetland Areas', unit: 'ha' },

  // Wetland Densities
  { value: 'riverine_density', label: 'Rivers, Channels, and Bars (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },
  { value: 'lake_density', label: 'Lakes (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },
  { value: 'pond_density', label: 'Ponds (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },
  { value: 'shore_density', label: 'Shores, Salt Flats, and Unvegetated Wetlands (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },
  { value: 'woody_density', label: 'Woody Wetlands (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },
  { value: 'emergent_density', label: 'Emergent Wetlands (ha/km²)', category: 'Wetland Densities', unit: 'ha/km²' },

  // Riparian
  { value: 'riparian_percent', label: 'Riparian Mapping (%)', category: 'Riparian', unit: '%' },
  { value: 'riparian_woody_area', label: 'Woody Riparian Area (ha)', category: 'Riparian', unit: 'ha' },
  { value: 'riparian_herbaceous_area', label: 'Herbaceous Riparian Area (ha)', category: 'Riparian', unit: 'ha' },

  // Land Ownership
  { value: 'federal_percent', label: 'Federal Ownership (%)', category: 'Land Ownership', unit: '%' },
  { value: 'state_percent', label: 'State Ownership (%)', category: 'Land Ownership', unit: '%' },
  { value: 'private_percent', label: 'Private Ownership (%)', category: 'Land Ownership', unit: '%' },
  { value: 'tribal_percent', label: 'Tribal Ownership (%)', category: 'Land Ownership', unit: '%' },
  { value: 'riverine_federal_percent', label: 'Federal Rivers, Channels, and Bars (%)', category: 'Land Ownership', unit: '%' },
  { value: 'riverine_state_percent', label: 'State Rivers, Channels, and Bars (%)', category: 'Land Ownership', unit: '%' },
  { value: 'riverine_private_percent', label: 'Private Rivers, Channels, and Bars (%)', category: 'Land Ownership', unit: '%' },
  { value: 'riverine_tribal_percent', label: 'Tribal Rivers, Channels, and Bars (%)', category: 'Land Ownership', unit: '%' },
  { value: 'waterbody_federal_percent', label: 'Federal Lakes, Ponds, and Shores (%)', category: 'Land Ownership', unit: '%' },
  { value: 'waterbody_state_percent', label: 'State Lakes, Ponds, and Shores (%)', category: 'Land Ownership', unit: '%' },
  { value: 'waterbody_private_percent', label: 'Private Lakes, Ponds, and Shores (%)', category: 'Land Ownership', unit: '%' },
  { value: 'waterbody_tribal_percent', label: 'Tribal Lakes, Ponds, and Shores (%)', category: 'Land Ownership', unit: '%' },
  { value: 'vegetated_federal_percent', label: 'Federal Vegetated Wetlands (%)', category: 'Land Ownership', unit: '%' },
  { value: 'vegetated_state_percent', label: 'State Vegetated Wetlands (%)', category: 'Land Ownership', unit: '%' },
  { value: 'vegetated_private_percent', label: 'Private Vegetated Wetlands (%)', category: 'Land Ownership', unit: '%' },
  { value: 'vegetated_tribal_percent', label: 'Tribal Vegetated Wetlands (%)', category: 'Land Ownership', unit: '%' },

  // Ownership Ratios
  { value: 'vegetated_private_ratio', label: 'Private Vegetated Wetlands to Private Ownership Ratio', category: 'Ownership Ratios' },
  { value: 'riverine_private_ratio', label: 'Private Rivers, Channels, and Bars to Private Ownership Ratio', category: 'Ownership Ratios' },
  { value: 'waterbody_private_ratio', label: 'Private Lakes, Ponds, and Shores to Private Ownership Ratio', category: 'Ownership Ratios' },

  // Surface Water Trends (HUC12 & HUC8 only)
  {
    value: 'surface_water_trend',
    label: 'Growing Season 30-Year Surface Water Trend',
    category: 'Surface Water Trends',
    isCategorical: true,
    allowedLayers: [HUC12_TITLE, HUC8_TITLE],
  },
  {
    value: 'surface_water_slope',
    label: "Sen's Slope for Surface Water (ha/yr)",
    category: 'Surface Water Trends',
    unit: 'ha/yr',
    allowedLayers: [HUC12_TITLE, HUC8_TITLE],
  },

  // Groundwater Wells (HUC8 only)
  {
    value: 'pct_wells_rising',
    label: 'Rising Groundwater Wells (% of Wells)',
    category: 'Groundwater Wells',
    unit: '%',
    allowedLayers: [HUC8_TITLE],
  },
  {
    value: 'pct_wells_falling',
    label: 'Falling Groundwater Wells (% of Wells)',
    category: 'Groundwater Wells',
    unit: '%',
    allowedLayers: [HUC8_TITLE],
  },
  {
    value: 'mean_rising_slope',
    label: "Mean Sen's Slope Rising Wells (ft/yr)",
    category: 'Groundwater Wells',
    unit: 'ft/yr',
    allowedLayers: [HUC8_TITLE],
  },
  {
    value: 'mean_falling_slope',
    label: "Mean Sen's Slope Falling Wells (ft/yr)",
    category: 'Groundwater Wells',
    unit: 'ft/yr',
    allowedLayers: [HUC8_TITLE],
  },
]

export function resolveMetricsForLayer(layerTitle: string): LandscapeMetric[] {
  return LANDSCAPE_METRICS.filter((m) => {
    if (!m.allowedLayers) return true
    return m.allowedLayers.includes(layerTitle)
  })
}

export type ClassificationMethod = 'quantile' | 'equal-interval' | 'natural-breaks'

export interface ColorRampConfig {
  label: string
  colors: Record<number, string[]>
}

export const COLOR_RAMPS: Record<string, ColorRampConfig> = {
  blues: {
    label: 'Blues',
    colors: {
      2: ['#c6dbef', '#2171b5'],
      3: ['#deebf7', '#9ecae1', '#3182bd'],
      4: ['#eff3ff', '#bdd7e7', '#6baed6', '#2171b5'],
      5: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
      6: ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
      7: ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
      8: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'],
      9: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      10: ['#f7fbff', '#e3eef9', '#cfe1f2', '#b5d4e9', '#93c3df', '#6daed5', '#4b97c9', '#2f7ebc', '#1864aa', '#0a498f'],
    },
  },
  ylgnbu: {
    label: 'Yellow-Green-Blue',
    colors: {
      2: ['#c7e9b4', '#225ea8'],
      3: ['#edf8b1', '#7fcdbb', '#2c7fb8'],
      4: ['#ffffcc', '#a1dab4', '#41b6c4', '#225ea8'],
      5: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
      6: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494'],
      7: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
      8: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
      9: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
      10: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58', '#040e28'],
    },
  },
  viridis: {
    label: 'Viridis',
    colors: {
      2: ['#440154', '#fde725'],
      3: ['#440154', '#21918c', '#fde725'],
      4: ['#440154', '#31688e', '#35b779', '#fde725'],
      5: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
      6: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
      7: ['#440154', '#443983', '#31688e', '#21918c', '#35b779', '#8fd744', '#fde725'],
      8: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
      9: ['#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c', '#28ae80', '#5ec962', '#addc30', '#fde725'],
      10: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'],
    },
  },
  greens: {
    label: 'Greens',
    colors: {
      2: ['#c7e9c0', '#238b45'],
      3: ['#e5f5e0', '#a1d99b', '#31a354'],
      4: ['#edf8e9', '#bae4b3', '#74c476', '#238b45'],
      5: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
      6: ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#31a354', '#006d2c'],
      7: ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
      8: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'],
      9: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      10: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#002609'],
    },
  },
  oranges: {
    label: 'Oranges',
    colors: {
      2: ['#fdd0a2', '#d94801'],
      3: ['#fee6ce', '#fdae6b', '#e6550d'],
      4: ['#feedde', '#fdbe85', '#fd8d3c', '#d94801'],
      5: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
      6: ['#feedde', '#fdd0a2', '#fdae6b', '#fd8d3c', '#e6550d', '#a63603'],
      7: ['#feedde', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'],
      8: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'],
      9: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
      10: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704', '#4c1702'],
    },
  },
  purples: {
    label: 'Purples',
    colors: {
      2: ['#dadaeb', '#6a51a3'],
      3: ['#efedf5', '#bcbddc', '#756bb1'],
      4: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#6a51a3'],
      5: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
      6: ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#756bb1', '#54278f'],
      7: ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'],
      8: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'],
      9: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
      10: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d', '#26004c'],
    },
  },
  spectral: {
    label: 'Spectral',
    colors: {
      2: ['#d7191c', '#2b83ba'],
      3: ['#fc8d59', '#ffffbf', '#99d594'],
      4: ['#d7191c', '#fdae61', '#abdda4', '#2b83ba'],
      5: ['#d7191c', '#fdae61', '#ffffbf', '#abdda4', '#2b83ba'],
      6: ['#d53e4f', '#fc8d59', '#fee08b', '#e6f598', '#99d594', '#3288bd'],
      7: ['#d53e4f', '#fc8d59', '#fee08b', '#ffffbf', '#e6f598', '#99d594', '#3288bd'],
      8: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'],
      9: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'],
      10: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
    },
  },
}

export function getColorRampColors(rampKey: string, numClasses: number): string[] {
  const ramp = COLOR_RAMPS[rampKey] ?? COLOR_RAMPS['blues']
  const clamped = Math.min(10, Math.max(2, numClasses))
  return ramp.colors[clamped] ?? ramp.colors[5]
}

export function equalIntervalBreaks(values: number[], numClasses: number): number[] {
  if (values.length === 0 || numClasses <= 1) return []
  const min = values[0]
  const max = values[values.length - 1]
  if (min === max) return []
  const step = (max - min) / numClasses
  return Array.from({ length: numClasses - 1 }, (_, i) => min + (i + 1) * step)
}

export function quantileBreaks(values: number[], numClasses: number): number[] {
  if (values.length === 0 || numClasses <= 1) return []
  const breaks: number[] = []
  for (let i = 1; i < numClasses; i++) {
    const idx = Math.floor((i * values.length) / numClasses) - 1
    breaks.push(values[Math.max(0, idx)])
  }
  return breaks
}

export function naturalBreaks(values: number[], numClasses: number): number[] {
  if (values.length === 0 || numClasses <= 1 || values[0] === values[values.length - 1]) return []
  const n = values.length
  if (n <= numClasses) {
    return values.slice(0, -1)
  }

  // Downsample to at most 1000 evenly spaced points if array is large
  let data = values
  if (n > 1000) {
    const step = (n - 1) / 999
    data = Array.from({ length: 1000 }, (_, i) => values[Math.round(i * step)])
  }
  const len = data.length

  const mat1: number[][] = Array.from({ length: len + 1 }, () => Array(numClasses + 1).fill(0))
  const mat2: number[][] = Array.from({ length: len + 1 }, () => Array(numClasses + 1).fill(0))

  for (let y = 1; y <= numClasses; y++) {
    mat1[1][y] = 1
    mat2[1][y] = 0
    for (let t = 2; t <= len; t++) {
      mat2[t][y] = Infinity
    }
  }

  let v = 0
  for (let l = 2; l <= len; l++) {
    let s1 = 0
    let s2 = 0
    let w = 0
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1
      const val = data[i3 - 1]
      s2 += val * val
      s1 += val
      w += 1
      v = s2 - (s1 * s1) / w
      const i4 = i3 - 1
      if (i4 !== 0) {
        for (let j = 2; j <= numClasses; j++) {
          if (mat2[l][j] >= v + mat2[i4][j - 1]) {
            mat1[l][j] = i3
            mat2[l][j] = v + mat2[i4][j - 1]
          }
        }
      }
    }
    mat1[l][1] = 1
    mat2[l][1] = v
  }

  let k = len
  const kclass: number[] = Array(numClasses + 1).fill(0)
  kclass[numClasses] = data[len - 1]

  for (let j = numClasses; j >= 2; j--) {
    const id = mat1[k][j] - 2
    if (id < 0 || id >= data.length) return []
    kclass[j - 1] = data[id]
    k = mat1[k][j] - 1
  }

  return kclass.slice(1, numClasses)
}

export function computeClassBreaks(
  method: ClassificationMethod,
  values: number[],
  numClasses: number
): number[] {
  if (values.length === 0 || numClasses <= 1) return []
  const min = values[0]
  const max = values[values.length - 1]
  if (min === max) return []

  let rawBreaks: number[] = []
  switch (method) {
    case 'equal-interval':
      rawBreaks = equalIntervalBreaks(values, numClasses)
      break
    case 'quantile':
      rawBreaks = quantileBreaks(values, numClasses)
      break
    case 'natural-breaks':
      rawBreaks = naturalBreaks(values, numClasses)
      break
    default:
      rawBreaks = quantileBreaks(values, numClasses)
  }

  // Ensure strictly ascending, unique stops that are > min and < max
  const sortedUnique = Array.from(new Set(rawBreaks))
    .filter((b) => b > min && b < max)
    .sort((a, b) => a - b)

  return sortedUnique
}
