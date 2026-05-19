import { PROD_GEOSERVER_URL } from '@/lib/constants'

/**
 * Bin derived from a single rule in a WMS GetLegendGraphic response. Mirrors
 * the SLD class boundaries on `value_inch`, so the chart's stacked bars and
 * swatches use the exact same breaks + colors the map renders with.
 */
export interface SldBin {
    name: string         // raw rule name, e.g. "class_3" or "Zero"
    title: string        // human-readable, e.g. "-8 – -6 in"
    min: number          // -Infinity for the lowest open bin
    max: number          // Infinity for the highest open bin
    color: string        // hex from Polygon.fill
    isZero: boolean      // true for the "within uncertainty" deadband bin
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

// Parse a SLD CQL-style filter like:
//   [value_inch >= '-12' AND value_inch < '-8' AND NOT (value_inch >= '-1.2' AND value_inch <= '1.2')]
// Strips the NOT-deadband subclause, then walks value_inch <op> 'N' pairs to
// derive {min, max}. Half-open (< / <=) treated the same for binning purposes.
function parseBoundsFromFilter(filter: string): { min: number; max: number } {
    const stripped = filter.replace(/\s+AND\s+NOT\s*\([^)]+\)/g, '')
    const re = /value_inch\s*(>=|<=|>|<)\s*'(-?\d+(?:\.\d+)?)'/g
    let min = -Infinity
    let max = Infinity
    let m: RegExpExecArray | null
    while ((m = re.exec(stripped)) !== null) {
        const op = m[1]
        const v = parseFloat(m[2])
        if (op === '>=' || op === '>') min = Math.max(min, v)
        if (op === '<=' || op === '<') max = Math.min(max, v)
    }
    return { min, max }
}

export async function fetchDisplacementSldBins(styleName: string): Promise<SldBin[]> {
    const url = new URL(`${PROD_GEOSERVER_URL}/wms`)
    url.searchParams.set('service', 'WMS')
    url.searchParams.set('request', 'GetLegendGraphic')
    url.searchParams.set('format', 'application/json')
    url.searchParams.set('layer', 'hazards:merged_displacement_contours_test_all')
    url.searchParams.set('style', styleName)
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`WMS legend ${res.status}`)
    const data = await res.json() as LegendResponse
    const rules = data.Legend?.[0]?.rules ?? []
    const bins: SldBin[] = rules
        .filter(r => r.filter && r.symbolizers?.[0]?.Polygon?.fill)
        .map(r => {
            const { min, max } = parseBoundsFromFilter(r.filter!)
            return {
                name: r.name ?? '',
                title: r.title ?? '',
                min,
                max,
                color: r.symbolizers![0].Polygon!.fill ?? '#999',
                isZero: r.name === 'Zero',
            }
        })
    // Sort by lower bound so stacked bars + legend swatches read left-to-right.
    bins.sort((a, b) => a.min - b.min)
    return bins
}
