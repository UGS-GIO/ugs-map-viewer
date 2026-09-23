import { getZeroBound, type SldBin } from './displacement-sld-legend'

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

// Threshold options: SLD class edges kept only when a real, non-deadband feature
// sits in the band [edge, nextEdge). Two consecutive edges filter to the same set
// unless some feature's |value| falls between them, so an SLD class the data never
// fills would otherwise offer a redundant option. Concretely for Cumulative,
// contours are odd inches and ±1 is the deadband, so the 1–3 in band is empty and
// "1 in" would filter identically to "3 in" — this drops the 1. `magnitudes` is
// the ascending distinct |value_inches_min| present for the type. The first element
// is the smallest meaningful threshold, and is used as the per-type default so the
// map, chart, and dropdown all agree.
export function getPopulatedBinBoundaries(bins: SldBin[], magnitudes: number[]): number[] {
    const edges = getBinBoundaries(bins)
    const zeroBound = getZeroBound(bins) ?? 0
    const measured = magnitudes.filter(m => m > zeroBound)
    return edges.filter((edge, i) => {
        const next = edges[i + 1] ?? Infinity
        return measured.some(m => m >= edge && m < next)
    })
}
