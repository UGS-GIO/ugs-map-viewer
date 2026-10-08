import { describe, it, expect } from 'vitest'
import {
  equalIntervalBreaks,
  quantileBreaks,
  naturalBreaks,
  computeClassBreaks,
  resolveMetricsForLayer,
  getColorRampColors,
  HUC12_TITLE,
  HUC8_TITLE,
  HUC12_ECO_TITLE,
  ECOREGION_TITLE,
} from '../-data/landscape-metrics'

describe('Landscape classification breaks', () => {
  it('calculates equal interval breaks correctly', () => {
    const breaks = equalIntervalBreaks([0, 100], 5)
    expect(breaks).toHaveLength(4)
    expect(breaks).toEqual([20, 40, 60, 80])
  })

  it('calculates quantile breaks correctly', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const breaks = quantileBreaks(data, 5)
    expect(breaks).toHaveLength(4)
    expect(breaks[0]).toBeLessThanOrEqual(breaks[1])
    expect(breaks[1]).toBeLessThanOrEqual(breaks[2])
    expect(breaks[2]).toBeLessThanOrEqual(breaks[3])
  })

  it('calculates natural breaks (Jenks) correctly', () => {
    const clustered = [1, 2, 2, 3, 10, 11, 12, 13, 50, 51, 52]
    const breaks = naturalBreaks(clustered, 3)
    expect(breaks).toHaveLength(2)
    // The clusters are ~[1,3], ~[10,13], ~[50,52]
    expect(breaks[0]).toBeGreaterThanOrEqual(3)
    expect(breaks[0]).toBeLessThanOrEqual(10)
    expect(breaks[1]).toBeGreaterThanOrEqual(13)
    expect(breaks[1]).toBeLessThanOrEqual(50)
  })

  it('handles empty data or single-class requests gracefully', () => {
    expect(equalIntervalBreaks([], 5)).toEqual([])
    expect(quantileBreaks([], 5)).toEqual([])
    expect(naturalBreaks([], 5)).toEqual([])
    expect(equalIntervalBreaks([5, 5], 5)).toEqual([])
    expect(naturalBreaks([5, 5, 5, 5], 5)).toEqual([])
  })

  it('computeClassBreaks produces strictly ascending unique stops', () => {
    // Skewed data where percentiles land on duplicate values (like utah_percent mostly 0 and 100)
    const skewed = [0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100]
    const breaks = computeClassBreaks('quantile', skewed, 5)
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i]).toBeLessThan(breaks[i + 1])
    }
    for (const b of breaks) {
      expect(b).toBeGreaterThan(0)
      expect(b).toBeLessThan(100)
    }
  })

  it('computeClassBreaks returns empty for uniform values', () => {
    const uniform = [50, 50, 50, 50]
    expect(computeClassBreaks('quantile', uniform, 5)).toEqual([])
    expect(computeClassBreaks('equal-interval', uniform, 5)).toEqual([])
    expect(computeClassBreaks('natural-breaks', uniform, 5)).toEqual([])
  })
})

describe('resolveMetricsForLayer', () => {
  it('includes surface water trend and slope for HUC12', () => {
    const metrics = resolveMetricsForLayer(HUC12_TITLE)
    const values = metrics.map((m) => m.value)
    expect(values).toContain('surface_water_trend')
    expect(values).toContain('surface_water_slope')
    expect(values).not.toContain('pct_wells_rising')
  })

  it('includes surface water and groundwater wells for HUC8', () => {
    const metrics = resolveMetricsForLayer(HUC8_TITLE)
    const values = metrics.map((m) => m.value)
    expect(values).toContain('surface_water_trend')
    expect(values).toContain('surface_water_slope')
    expect(values).toContain('pct_wells_rising')
    expect(values).toContain('pct_wells_falling')
    expect(values).toContain('mean_rising_slope')
    expect(values).toContain('mean_falling_slope')
  })

  it('excludes surface water and groundwater wells for HUC12 by Ecoregion and Ecoregion', () => {
    const ecoMetrics = resolveMetricsForLayer(HUC12_ECO_TITLE)
    const ecoValues = ecoMetrics.map((m) => m.value)
    expect(ecoValues).not.toContain('surface_water_trend')
    expect(ecoValues).not.toContain('surface_water_slope')
    expect(ecoValues).not.toContain('pct_wells_rising')

    const pureEcoMetrics = resolveMetricsForLayer(ECOREGION_TITLE)
    const pureEcoValues = pureEcoMetrics.map((m) => m.value)
    expect(pureEcoValues).not.toContain('surface_water_trend')
    expect(pureEcoValues).not.toContain('surface_water_slope')
    expect(pureEcoValues).not.toContain('pct_wells_rising')
  })

  it('includes common wetland and ownership metrics across all layers', () => {
    for (const title of [HUC12_TITLE, HUC8_TITLE, HUC12_ECO_TITLE, ECOREGION_TITLE]) {
      const values = resolveMetricsForLayer(title).map((m) => m.value)
      expect(values).toContain('utah_percent')
      expect(values).toContain('emergent_density')
      expect(values).toContain('federal_percent')
      expect(values).toContain('riparian_percent')
    }
  })
})

describe('getColorRampColors', () => {
  it('returns requested number of colors for valid ramps', () => {
    for (const num of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const colors = getColorRampColors('blues', num)
      expect(colors).toHaveLength(num)
    }
  })

  it('clamps classes below 2 and above 10', () => {
    expect(getColorRampColors('blues', 1)).toHaveLength(2)
    expect(getColorRampColors('blues', 15)).toHaveLength(10)
  })

  it('falls back to blues if ramp name is unknown', () => {
    const colors = getColorRampColors('unknown_ramp', 5)
    expect(colors).toHaveLength(5)
  })
})
