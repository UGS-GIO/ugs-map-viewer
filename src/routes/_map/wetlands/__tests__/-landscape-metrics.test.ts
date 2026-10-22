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
import { buildChoroplethStepExpression } from '../-hooks/use-landscape-choropleth'

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
      expect(b).toBeLessThanOrEqual(100)
    }
  })

  it('calculates quantile breaks accurately for small unique datasets without dropping classes', () => {
    // Utah Ecoregions has 11 features
    const ecoregions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    for (let k = 2; k <= 10; k++) {
      const breaks = computeClassBreaks('quantile', ecoregions, k)
      expect(breaks).toHaveLength(k - 1)
      for (let i = 0; i < breaks.length - 1; i++) {
        expect(breaks[i]).toBeLessThan(breaks[i + 1])
      }
    }
  })

  it('handles zero-inflated quantile distributions without collapsing into 1 flat color', () => {
    // Mackenzie's HUC8 case: 44 zeros and 23 positive values
    const huc8Data = [
      ...Array(44).fill(0),
      1.0, 1.1, 3.9, 4.0, 4.6, 4.7, 5.2, 6.1, 11.0, 14.1, 14.9, 16.0, 17.7, 19.6, 30.1, 30.9, 32.4, 37.3, 37.9, 40.8, 48.5, 68.9, 98.6,
    ]
    const breaks = computeClassBreaks('quantile', huc8Data, 8)
    expect(breaks).toHaveLength(7)
    expect(breaks[0]).toBe(1.0)
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i]).toBeLessThan(breaks[i + 1])
    }
  })

  it('handles dual boundary saturation (0s and 100s with intermediate values) gracefully', () => {
    // utah_percent case with 0s, 100s, and border values
    const utahPctData = [
      ...Array(20).fill(0),
      5, 12, 25, 50, 75, 90,
      ...Array(40).fill(100),
    ]
    const breaks = computeClassBreaks('quantile', utahPctData, 5)
    expect(breaks.length).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < breaks.length - 1; i++) {
      expect(breaks[i]).toBeLessThan(breaks[i + 1])
    }
    expect(breaks[breaks.length - 1]).toBe(100)
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

describe('buildChoroplethStepExpression', () => {
  it('builds step expression with safe fallback when minVal is finite', () => {
    const expr = buildChoroplethStepExpression('utah_percent', 12.5, [25, 50, 75], ['#c6dbef', '#6baed6', '#2171b5', '#08306b'])
    expect(expr[0]).toBe('case')
    expect(expr[1]).toEqual(['all', ['has', 'utah_percent'], ['!=', ['get', 'utah_percent'], null]])
    const stepArgs = expr[2] as unknown[]
    expect(stepArgs[0]).toBe('step')
    expect(stepArgs[1]).toEqual(['to-number', ['get', 'utah_percent'], 12.5])
    expect(stepArgs[2]).toBe('#c6dbef')
    expect(stepArgs[3]).toBe(25)
    expect(stepArgs[4]).toBe('#6baed6')
    expect(stepArgs[5]).toBe(50)
    expect(stepArgs[6]).toBe('#2171b5')
    expect(stepArgs[7]).toBe(75)
    expect(stepArgs[8]).toBe('#08306b')
    expect(expr[3]).toBe('rgba(168, 168, 168, 0.15)')
  })

  it('guards non-finite and NaN minVal with 0 fallback', () => {
    const nanExpr = buildChoroplethStepExpression('utah_percent', NaN, [25, 50], ['#aaa', '#bbb', '#ccc'])
    const nanStepArgs = nanExpr[2] as unknown[]
    expect(nanStepArgs[1]).toEqual(['to-number', ['get', 'utah_percent'], 0])

    const infExpr = buildChoroplethStepExpression('utah_percent', Infinity, [25, 50], ['#aaa', '#bbb', '#ccc'])
    const infStepArgs = infExpr[2] as unknown[]
    expect(infStepArgs[1]).toEqual(['to-number', ['get', 'utah_percent'], 0])

    const negInfExpr = buildChoroplethStepExpression('utah_percent', -Infinity, [25, 50], ['#aaa', '#bbb', '#ccc'])
    const negInfStepArgs = negInfExpr[2] as unknown[]
    expect(negInfStepArgs[1]).toEqual(['to-number', ['get', 'utah_percent'], 0])
  })
})

describe('Metric compatibility and scale switching', () => {
  it('detects incompatible metric on scale switch and falls back to allowedMetrics[0]', () => {
    const huc8Metrics = resolveMetricsForLayer(HUC8_TITLE)
    const ecoregionMetrics = resolveMetricsForLayer(ECOREGION_TITLE)

    const groundwaterMetric = 'pct_wells_rising'
    expect(huc8Metrics.some((m) => m.value === groundwaterMetric)).toBe(true)
    expect(ecoregionMetrics.some((m) => m.value === groundwaterMetric)).toBe(false)

    // Verification logic matching LandscapeDataFilters:
    const isMetricValid = ecoregionMetrics.some((m) => m.value === groundwaterMetric)
    expect(isMetricValid).toBe(false)
    const fallbackMetric = ecoregionMetrics.find((m) => m.value === groundwaterMetric) || ecoregionMetrics[0]
    expect(fallbackMetric.value).toBe('utah_percent')
  })

  it('preserves compatible metric when switching between scales that both support it', () => {
    const huc8Metrics = resolveMetricsForLayer(HUC8_TITLE)
    const huc12Metrics = resolveMetricsForLayer(HUC12_TITLE)

    const trendMetric = 'surface_water_trend'
    expect(huc8Metrics.some((m) => m.value === trendMetric)).toBe(true)
    expect(huc12Metrics.some((m) => m.value === trendMetric)).toBe(true)

    const isMetricValidOnHuc12 = huc12Metrics.some((m) => m.value === trendMetric)
    expect(isMetricValidOnHuc12).toBe(true)
  })
})
