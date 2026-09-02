import { buildGetLegendGraphicUrl } from '@/lib/legend/wms-legend-service'
import { DISPLACEMENT_TYPE_NAME } from './displacement-layers'

/**
 * Bin derived from a single rule in a WMS GetLegendGraphic response. Mirrors
 * the SLD class boundaries on `value_inches`, so the chart's stacked bars and
 * swatches use the exact same breaks + colors the map renders with.
 */
export interface SldBin {
    name: string         // raw rule name, e.g. "class_3" or "Zero"
    title: string        // human-readable, e.g. "-8 – -6 in"
    min: number          // -Infinity for the lowest open bin
    max: number          // Infinity for the highest open bin
    color: string        // hex from Polygon.fill
    isZero: boolean      // true for the "within uncertainty" deadband bin (straddles 0)
    include: SldComparison[]  // the rule's own comparisons, operators intact
    exclude: SldComparison[]  // comparisons under its NOT(...) subclause
}

/** One `value_inches <op> N` test from an SLD rule filter. */
export interface SldComparison {
    op: '>=' | '<=' | '>' | '<'
    value: number
}

interface LegendRule {
    name?: string
    title?: string
    filter?: string
    symbolizers?: Array<{ Polygon?: { fill?: string } }>
}

interface LegendResponse {
    Legend?: Array<{ rules?: LegendRule[] }>
}

function parseComparisons(text: string): SldComparison[] {
    const re = /value_inches\s*(>=|<=|>|<)\s*'?(-?\d+(?:\.\d+)?)'?/g
    const out: SldComparison[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
        out.push({ op: m[1] as SldComparison['op'], value: parseFloat(m[2]) })
    }
    return out
}

// Parse a SLD CQL-style filter like:
//   [value_inches >= '-12' AND value_inches < '-8' AND NOT (value_inches >= '-2' AND value_inches <= '2')]
// The NOT-deadband subclause is kept, not stripped: it's inclusive at both ends
// while band bounds are half-open, so values on a shared edge (every contour —
// they're whole inches) belong to the deadband alone. {min, max} is still
// derived for ordering and deadband detection.
export function parseRuleFilter(filter: string): { include: SldComparison[]; exclude: SldComparison[]; min: number; max: number } {
    const excluded: string[] = []
    const stripped = filter.replace(/\s*AND\s+NOT\s*\(([^)]+)\)/g, (_full, inner: string) => {
        excluded.push(inner)
        return ''
    })
    const include = parseComparisons(stripped)
    const exclude = excluded.flatMap(parseComparisons)
    let min = -Infinity
    let max = Infinity
    for (const c of include) {
        if (c.op === '>=' || c.op === '>') min = Math.max(min, c.value)
        else max = Math.min(max, c.value)
    }
    return { include, exclude, min, max }
}

function satisfies(v: number, c: SldComparison): boolean {
    switch (c.op) {
        case '>=': return v >= c.value
        case '>': return v > c.value
        case '<=': return v <= c.value
        case '<': return v < c.value
    }
}

// Evaluates the rule the way GeoServer does — same operators, same exclusion. An
// unparsed filter matches nothing rather than everything, so a style change can't
// silently turn one class into a catch-all.
export function binMatches(bin: SldBin, v: number): boolean {
    if (bin.include.length === 0) return false
    if (!bin.include.every(c => satisfies(v, c))) return false
    if (bin.exclude.length > 0 && bin.exclude.every(c => satisfies(v, c))) return false
    return true
}

export async function fetchDisplacementSldBins(styleName: string): Promise<SldBin[]> {
    const url = buildGetLegendGraphicUrl(DISPLACEMENT_TYPE_NAME, undefined, styleName)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`WMS legend ${res.status}`)
    const data = await res.json() as LegendResponse
    const rules = data.Legend?.[0]?.rules ?? []
    const bins: SldBin[] = rules
        .filter(r => r.filter && r.symbolizers?.[0]?.Polygon?.fill)
        .map(r => {
            const { include, exclude, min, max } = parseRuleFilter(r.filter!)
            return {
                name: r.name ?? '',
                title: r.title ?? '',
                min,
                max,
                include,
                exclude,
                color: r.symbolizers![0].Polygon!.fill ?? '#999',
                // The deadband is the one class spanning both signs. Structural,
                // not by rule name — styles spell it 'Zero', 'excluded', etc.
                isZero: min < 0 && max > 0,
            }
        })
    // Sort by lower bound so stacked bars + legend swatches read left-to-right.
    bins.sort((a, b) => a.min - b.min)
    return bins
}

// Resolve the SLD's "Zero" deadband to a single positive bound — the magnitude
// at or below which the SLD treats values as "within uncertainty". Used as the
// default threshold so filter behavior tracks SLD changes automatically.
export function getZeroBound(bins: SldBin[]): number | null {
    const zero = bins.find(b => b.isZero)
    if (!zero) return null
    return Math.max(Math.abs(zero.min), Math.abs(zero.max))
}

// Unsigned-magnitude label for a non-deadband bin, so a subsidence bin reads
// "3 – 5 in" (how deep it subsided) instead of "-5 – -3 in". Direction is already
// carried by the Uplift/Subsidence column and the color, so the sign is redundant
// and "negative subsidence" is confusing. Derived from the bin's own bounds, so it
// tracks the SLD. Not meaningful for the deadband bin, which keeps its own title.
export function magnitudeLabel(bin: SldBin, unit = 'in'): string {
    const lo = Math.min(Math.abs(bin.min), Math.abs(bin.max))
    const hi = Math.max(Math.abs(bin.min), Math.abs(bin.max))
    if (!Number.isFinite(hi)) return `> ${lo} ${unit}`
    return `${lo} – ${hi} ${unit}`
}
