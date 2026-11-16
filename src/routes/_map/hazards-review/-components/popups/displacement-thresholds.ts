import { getZeroBound, type SldBin } from './displacement-sld-legend'

// Each contour is a band [value_inches_min, value_inches_max]. A band clears a
// threshold of X in when its SHALLOW edge (the one nearer zero) is at least X,
// so "≥ 3 in" hides the 1-3 in band rather than counting it by its deep edge.
// Bands that straddle zero are the within-error band and get 0.
export function bandShallowMagnitude(min: number, max: number): number {
    if (max <= 0) return Math.abs(max)
    if (min >= 0) return min
    return 0
}

// CQL twin of `bandShallowMagnitude(min, max) >= inches`.
export function bandAtLeastCql(inches: number): string {
    return `(value_inches_max <= ${-inches} OR value_inches_min >= ${inches})`
}

// Positive SLD class edges (magnitudes), deduped + sorted ascending. These are
// the structural boundaries from the style; getPopulatedBinBoundaries trims them
// to the ones the data actually backs.
export function getBinBoundaries(bins: SldBin[]): number[] {
    const edges = new Set<number>()
    for (const b of bins) {
        if (b.isZero) continue
        for (const v of [b.min, b.max]) {
            if (Number.isFinite(v)) edges.add(Math.abs(v))
        }
    }
    return Array.from(edges).filter(v => v > 0).sort((a, b) => a - b)
}

// Threshold options: SLD class edges kept only when a real, non-deadband band
// starts in [edge, nextEdge). Two consecutive edges filter to the same set unless
// some band's shallow edge falls between them, so an SLD class the data never
// fills would otherwise offer a redundant option. `magnitudes` is the ascending
// distinct bandShallowMagnitude present for the type (0 = within error). The
// first element is the smallest meaningful threshold and the per-type default,
// so the map, chart, and dropdown all agree.
export function getPopulatedBinBoundaries(bins: SldBin[], magnitudes: number[]): number[] {
    const edges = getBinBoundaries(bins)
    const zeroBound = getZeroBound(bins) ?? 0
    const measured = magnitudes.filter(m => m > 0 && m >= zeroBound)
    return edges.filter((edge, i) => {
        const next = edges[i + 1] ?? Infinity
        return measured.some(m => m >= edge && m < next)
    })
}
