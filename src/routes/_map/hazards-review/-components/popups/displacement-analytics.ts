/**
 * Pure aggregation helpers for the redesigned displacement panel (ALL-5673):
 * depth-first summaries over the raw feature set, kept side-effect-free and
 * unit-tested so the sidebar summary, the by-basin ranking, and the pop-out all
 * read one consistent set of numbers. Area is injected (`areaMi2Of`) so callers
 * keep the turf dependency and these functions stay trivially testable.
 *
 * Sign convention (matches the SLD + the source data): subsidence is negative
 * `value_inches`, uplift positive. "Depth" is the downward magnitude —
 * `-value_inches` for a sinking feature, 0 for a rising/flat one.
 *
 * Contours are disjoint bands (verified: the -1in polygon does not contain the
 * -5in polygon), so summing the areas of every band at/below a threshold is an
 * honest total with no double-count.
 */
import type { DisplacementFeature } from './use-displacement-queries'

// Local, dependency-free copy of the query module's year accessor so this pure
// module (and its unit test) don't pull react-query/turf at runtime. `year` is
// the observation window's closing year for every displacement type.
function bucketYear(f: DisplacementFeature): string | null {
    return f.properties.year == null ? null : String(f.properties.year)
}

/** Downward displacement (subsidence depth, inches); 0 when the feature is rising or flat. */
export function subsidenceDepthIn(f: DisplacementFeature): number {
    const v = f.properties.value_inches
    return v < 0 ? -v : 0
}

/** Deepest subsidence (inches) per basin. Basins whose only motion is uplift are omitted. */
export function deepestSubsidenceByBasin(features: DisplacementFeature[]): Map<string, number> {
    const out = new Map<string, number>()
    for (const f of features) {
        const loc = f.properties.location
        if (!loc) continue
        const depth = subsidenceDepthIn(f)
        if (depth <= 0) continue
        const cur = out.get(loc)
        if (cur === undefined || depth > cur) out.set(loc, depth)
    }
    return out
}

/** A year's deepest subsidence reading, plus the basin it was measured in. */
export interface YearDepth {
    depthIn: number
    /** Location (basin) of the deepest feature that year; null if the feature has none. */
    location: string | null
}

/**
 * Deepest subsidence (inches) per closing year — the depth-over-time series for
 * a scope — carrying the basin the deepest reading came from (the deepest point
 * can move between basins year to year, so callers surface it in the hover). Note
 * the deliberate asymmetry with {@link deepestSubsidenceByBasin}: a year whose
 * only motion is uplift is KEPT here at depth 0 (a continuous time axis shouldn't
 * silently drop interior years), whereas an uplift-only basin is dropped from the
 * ranking. Callers that want a strictly-subsidence series pre-filter their
 * features to `value_inches < 0` before calling.
 */
export function deepestSubsidenceByYear(features: DisplacementFeature[]): Map<string, YearDepth> {
    const out = new Map<string, YearDepth>()
    for (const f of features) {
        const y = bucketYear(f)
        if (!y) continue
        const depth = subsidenceDepthIn(f)
        const cur = out.get(y)
        if (cur === undefined || depth > cur.depthIn) out.set(y, { depthIn: depth, location: f.properties.location ?? null })
    }
    return out
}

/**
 * Total area (mi²) of features sinking at least `minInches`, per closing year.
 * Bands are disjoint, so this sum is the true footprint at/below the threshold.
 * `areaMi2Of` maps a feature to its area in square miles.
 */
export function subsidedAreaByYear(
    features: DisplacementFeature[],
    minInches: number,
    areaMi2Of: (f: DisplacementFeature) => number,
): Map<string, number> {
    const out = new Map<string, number>()
    for (const f of features) {
        if (subsidenceDepthIn(f) < minInches) continue
        const y = bucketYear(f)
        if (!y) continue
        out.set(y, (out.get(y) ?? 0) + areaMi2Of(f))
    }
    return out
}

export interface DisplacementSummary {
    /** Deepest subsidence anywhere in the set, inches. 0 when nothing sinks past `minInches`. */
    maxDepthIn: number
    /** Total area sinking ≥ `minInches`, mi². */
    areaMi2: number
    /** Distinct basins with at least one feature sinking ≥ `minInches`. */
    basinCount: number
}

/**
 * One-pass summary over an already year/quality/basin-scoped feature set at a
 * single threshold — backs the statewide totals above the by-basin ranking and
 * the per-basin hero.
 */
export function displacementSummary(
    features: DisplacementFeature[],
    minInches: number,
    areaMi2Of: (f: DisplacementFeature) => number,
): DisplacementSummary {
    let maxDepthIn = 0
    let areaMi2 = 0
    const basins = new Set<string>()
    for (const f of features) {
        const depth = subsidenceDepthIn(f)
        if (depth < minInches) continue
        if (depth > maxDepthIn) maxDepthIn = depth
        areaMi2 += areaMi2Of(f)
        if (f.properties.location) basins.add(f.properties.location)
    }
    return { maxDepthIn, areaMi2, basinCount: basins.size }
}
