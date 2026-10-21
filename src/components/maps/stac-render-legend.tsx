import { useQuery } from '@tanstack/react-query'
import { toTitleCase } from '@/lib/utils'
import { styleFragmentQueryOptions } from '@/components/maps/pmtiles-layer-source'
import { LegendSwatchGrid } from '@/components/maps/legend-swatch-grid'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'
import { swatchShapeOf } from '@/lib/legend/swatch-shape'

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

    return (
        <div className="px-1 py-1">
            <LegendSwatchGrid
                columns="single"
                shape={swatchShapeOf(fragment?.layers?.map(l => l.type) ?? [])}
                // ugs-styles keeps labels as the raw field value (lowercase) so consumers can join on it.
                items={entries.map(e => ({ key: e.label, label: toTitleCase(e.label), color: e.color, stroke: e.stroke }))}
            />
        </div>
    )
}
