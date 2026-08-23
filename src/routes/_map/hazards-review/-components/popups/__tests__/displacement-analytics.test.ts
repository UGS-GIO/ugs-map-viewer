import { describe, it, expect } from 'vitest'
import {
    subsidenceDepthIn,
    deepestSubsidenceByBasin,
    deepestSubsidenceByYear,
    subsidedAreaByYear,
    displacementSummary,
} from '../displacement-analytics'
import type { DisplacementFeature } from '../use-displacement-queries'
import type { DisplacementType } from '../displacement-layers'

// Minimal feature fixture — geometry is a stub since area is injected in tests.
const feat = (
    location: string,
    value_inches: number,
    year: number | null,
    type: DisplacementType = 'Cumulative',
): DisplacementFeature => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [] },
    properties: { location, type, year, value_inches },
})

const unitArea = () => 1

describe('subsidenceDepthIn', () => {
    it('reports downward magnitude for sinking, 0 for uplift/flat', () => {
        expect(subsidenceDepthIn(feat('A', -5, 2024))).toBe(5)
        expect(subsidenceDepthIn(feat('A', 3, 2024))).toBe(0)
        expect(subsidenceDepthIn(feat('A', 0, 2024))).toBe(0)
    })
})

describe('deepestSubsidenceByBasin', () => {
    it('keeps the deepest sink per basin and drops uplift-only basins', () => {
        const m = deepestSubsidenceByBasin([
            feat('A', -5, 2024), feat('A', -12, 2024), feat('A', 2, 2024),
            feat('B', -3, 2024),
            feat('C', 4, 2024), // uplift only
        ])
        expect(m.get('A')).toBe(12)
        expect(m.get('B')).toBe(3)
        expect(m.has('C')).toBe(false)
        expect(m.size).toBe(2)
    })
})

describe('deepestSubsidenceByYear', () => {
    it('keeps the deepest sink per closing year with its basin, and skips null years', () => {
        const m = deepestSubsidenceByYear([
            feat('A', -5, 2019),
            feat('A', -11, 2020), feat('B', -3, 2020),
            feat('C', 2, 2018), // uplift → depth 0
            feat('A', -9, null), // no year → skipped
        ])
        expect(m.get('2019')).toEqual({ depthIn: 5, location: 'A' })
        // 2020: A (-11 → depth 11) is deeper than B (-3), so it carries the basin.
        expect(m.get('2020')).toEqual({ depthIn: 11, location: 'A' })
        expect(m.get('2018')).toEqual({ depthIn: 0, location: 'C' })
        expect(m.has('2017')).toBe(false)
        expect(m.size).toBe(3)
    })
})

describe('subsidedAreaByYear', () => {
    it('sums area of features at/below the threshold per year (disjoint bands)', () => {
        const m = subsidedAreaByYear(
            [feat('A', -5, 2019), feat('A', -2, 2019), feat('B', -9, 2020)],
            3,
            () => 2,
        )
        // 2019: only -5 clears ≥3 in (the -2 is under threshold) → one band × 2 mi².
        expect(m.get('2019')).toBe(2)
        expect(m.get('2020')).toBe(2)
        expect(m.size).toBe(2)
    })
})

describe('displacementSummary', () => {
    it('reports max depth, summed area, and distinct basins above the threshold', () => {
        const s = displacementSummary(
            [feat('A', -5, 2024), feat('A', -1, 2024), feat('B', -9, 2024), feat('C', 3, 2024)],
            3,
            unitArea,
        )
        expect(s.maxDepthIn).toBe(9)
        expect(s.areaMi2).toBe(2) // A(-5) + B(-9); A(-1) under threshold, C uplift excluded
        expect(s.basinCount).toBe(2)
    })

    it('is all-zero when nothing clears the threshold', () => {
        const s = displacementSummary([feat('A', -1, 2024), feat('B', 2, 2024)], 3, unitArea)
        expect(s).toEqual({ maxDepthIn: 0, areaMi2: 0, basinCount: 0 })
    })
})
