import { toTitleCase } from '@/lib/utils'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'

/**
 * Read-only legend for a PMTiles layer, straight from its STAC render's `legend`.
 * Replaces the WMS GetLegendGraphic image that vector layers no longer have.
 */
export function StacRenderLegend({ layer }: { layer: PMTilesLayerProps }) {
    const render = layer.renders?.find(r => r.id === layer.defaultRenderId) ?? layer.renders?.[0]
    const entries = render?.legend ?? []

    if (entries.length === 0) {
        return <div className="px-1 py-1 text-xs text-muted-foreground italic">No legend available</div>
    }

    return (
        <ul className="flex flex-col gap-1 px-1 py-1">
            {entries.map(entry => (
                <li key={entry.label} className="flex items-center gap-2 text-xs">
                    {/* Painted over the same paper tone the map shows, so a transparent or
                        part-transparent colour reads as see-through rather than as the panel. */}
                    <span
                        className="legend-swatch inline-block h-3 w-3 shrink-0 rounded-full border"
                        style={{
                            backgroundImage: `linear-gradient(${entry.color}, ${entry.color})`,
                            borderColor: entry.stroke ?? 'rgba(0,0,0,0.35)',
                        }}
                    />
                    {/* ugs-styles keeps labels as the raw field value (lowercase) so consumers can join on it. */}
                    <span className="min-w-0 break-words leading-tight">{toTitleCase(entry.label)}</span>
                </li>
            ))}
        </ul>
    )
}
