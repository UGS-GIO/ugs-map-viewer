import { useQuery } from '@tanstack/react-query'
import { toTitleCase } from '@/lib/utils'
import { styleFragmentQueryOptions } from '@/components/maps/pmtiles-layer-source'
import type { LegendEntry, PMTilesLayerProps } from '@/lib/types/mapping-types'
import { swatchShapeOf, type SwatchShape } from '@/lib/legend/swatch-shape'

// Sized like the WMS legend's SVG symbols (32x20 box, 28x14 polygon) so the rows line up.
function Swatch({ shape, entry }: { shape: SwatchShape; entry: LegendEntry }) {
    // Painted over the same paper tone the map shows, so a transparent or part-transparent
    // colour reads as see-through rather than as the panel.
    const paint = { backgroundImage: `linear-gradient(${entry.color}, ${entry.color})` }
    const border = entry.stroke ?? 'rgba(0,0,0,0.35)'
    if (shape === 'line') {
        return <span className="h-[3px] w-7 rounded-full" style={{ backgroundColor: entry.color }} />
    }
    if (shape === 'circle') {
        return <span className="legend-swatch h-3 w-3 rounded-full border" style={{ ...paint, borderColor: border }} />
    }
    return <span className="legend-swatch h-3.5 w-7 rounded-[2px] border" style={{ ...paint, borderColor: border }} />
}

/**
 * Read-only legend for a PMTiles layer, straight from its STAC render's `legend`.
 * Replaces the WMS GetLegendGraphic image that vector layers no longer have.
 */
export function StacRenderLegend({ layer }: { layer: PMTilesLayerProps }) {
    const render = layer.renders?.find(r => r.id === layer.defaultRenderId) ?? layer.renders?.[0]
    const entries = render?.legend ?? []
    // Same query the map draws from, so this is normally a cache hit.
    const { data: fragment, isLoading, error } = useQuery(styleFragmentQueryOptions(render?.styleUrl))

    if (entries.length === 0) {
        return <div className="px-1 py-1 text-xs text-muted-foreground italic">No legend available</div>
    }
    // Swatch shape comes from the fragment, so wait for it rather than flash dots first.
    if (isLoading) return <div className="px-1 py-1 text-xs text-muted-foreground">Loading legend...</div>
    if (error) return <div className="px-1 py-1 text-xs text-destructive">Error loading legend: {error.message}</div>

    const shape = swatchShapeOf(fragment?.layers?.map(l => l.type) ?? [])

    return (
        <ul className="flex flex-col gap-1 px-1 py-1">
            {entries.map(entry => (
                <li key={entry.label} className="flex items-center gap-2 text-xs">
                    <span className="flex w-8 min-w-8 items-center justify-center" aria-hidden>
                        <Swatch shape={shape} entry={entry} />
                    </span>
                    {/* ugs-styles keeps labels as the raw field value (lowercase) so consumers can join on it. */}
                    <span className="min-w-0 break-words leading-tight">{toTitleCase(entry.label)}</span>
                </li>
            ))}
        </ul>
    )
}
