import { useQuery } from '@tanstack/react-query'
import { toTitleCase } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'

function findLiteralObj(obj: unknown): Record<string, string> | null {
    if (!obj || typeof obj !== 'object') return null
    if (Array.isArray(obj)) {
        if (obj[0] === 'literal' && typeof obj[1] === 'object' && obj[1] !== null && !Array.isArray(obj[1])) {
            return obj[1] as Record<string, string>
        }
        for (const item of obj) {
            const res = findLiteralObj(item)
            if (res) return res
        }
    }
    return null
}

export function parseMapLibreStyleLegend(
    styleDoc: { layers?: Array<{ id?: string; type?: string; paint?: Record<string, unknown>; filter?: unknown[] }> },
    defaultTitle: string
): Array<{ label: string; color: string; stroke?: string }> {
    if (!styleDoc || !Array.isArray(styleDoc.layers)) return []
    const entries: Array<{ label: string; color: string; stroke?: string }> = []
    const seenLabels = new Set<string>()

    for (const layer of styleDoc.layers) {
        if (layer.type === 'symbol' || !layer.paint) continue

        const paint = layer.paint || {}
        const colorExpr = paint['fill-color'] || paint['line-color'] || paint['circle-color']
        const stroke = (paint['fill-outline-color'] as string)
            || (paint['circle-stroke-color'] as string)
            || (layer.type === 'line' ? (paint['line-color'] as string) : undefined)

        if (!colorExpr) continue

        // Pattern B: Literal dictionary anywhere in color expression
        const literalMap = findLiteralObj(colorExpr)
        if (literalMap) {
            for (const [label, color] of Object.entries(literalMap)) {
                if (typeof color === 'string' && !seenLabels.has(label)) {
                    seenLabels.add(label)
                    entries.push({ label, color, stroke })
                }
            }
            continue
        }

        // Pattern C: Match expression ['match', input, val1, col1, val2, col2, ..., defaultColor]
        if (Array.isArray(colorExpr) && colorExpr[0] === 'match') {
            for (let i = 2; i < colorExpr.length - 1; i += 2) {
                const val = colorExpr[i]
                const col = colorExpr[i + 1]
                if (typeof val === 'string' && typeof col === 'string' && !seenLabels.has(val)) {
                    seenLabels.add(val)
                    entries.push({ label: val, color: col, stroke })
                }
            }
            continue
        }

        // Pattern D: Sublayer with filter
        if (layer.filter && Array.isArray(layer.filter)) {
            const filter = layer.filter
            let labelVal: unknown = null
            if (filter[0] === '==' && filter.length >= 3) {
                labelVal = filter[2]
            }
            if (typeof labelVal === 'string' && typeof colorExpr === 'string' && !seenLabels.has(labelVal)) {
                seenLabels.add(labelVal)
                entries.push({ label: labelVal, color: colorExpr, stroke })
                continue
            }
        }

        // Pattern A: Simple color
        if (typeof colorExpr === 'string') {
            const label = defaultTitle || layer.id || 'Layer'
            if (!seenLabels.has(label)) {
                seenLabels.add(label)
                entries.push({ label, color: colorExpr, stroke })
            }
        }
    }

    return entries
}

/**
 * Read-only legend for a PMTiles layer, straight from its STAC render's `legend`,
 * falling back to parsing the MapLibre style JSON if no explicit legend is provided.
 */
export function StacRenderLegend({ layer }: { layer: PMTilesLayerProps }) {
    const render = layer.renders?.find(r => r.id === layer.defaultRenderId) ?? layer.renders?.[0]
    const explicitEntries = render?.legend ?? []

    const styleUrl = render?.styleUrl || layer.styleUrl
    const shouldFetchStyle = explicitEntries.length === 0 && !!styleUrl

    const { data: parsedEntries = [] } = useQuery({
        queryKey: queryKeys.layers.legend(layer.title || render?.id || 'stac', styleUrl),
        queryFn: async () => {
            if (!styleUrl) return []
            const res = await fetch(styleUrl)
            if (!res.ok) return []
            const styleDoc = await res.json()
            return parseMapLibreStyleLegend(styleDoc, render?.title || layer.title || '')
        },
        enabled: shouldFetchStyle,
        staleTime: Infinity,
    })

    const entries = explicitEntries.length > 0 ? explicitEntries : parsedEntries
    if (entries.length === 0) return null

    return (
        <ul className="flex flex-col gap-1 px-1 py-1">
            {entries.map(entry => (
                <li key={entry.label} className="flex items-center gap-2 text-xs">
                    <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: entry.color, borderColor: entry.stroke ?? 'rgba(0,0,0,0.3)' }}
                    />
                    {/* ugs-styles keeps labels as the raw field value (lowercase) so consumers can join on it. */}
                    <span className="min-w-0 break-words leading-tight">{toTitleCase(entry.label)}</span>
                </li>
            ))}
        </ul>
    )
}
