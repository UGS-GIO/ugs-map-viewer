import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { activeRenderOf, styleFragmentQueryOptions } from '@/components/maps/pmtiles-layer-source'
import { LegendSwatchGrid } from '@/components/maps/legend-swatch-grid'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'
import { swatchShapeOf } from '@/lib/legend/swatch-shape'

/**
 * Read-only legend for a PMTiles layer, straight from its active STAC render's `legend`.
 * Replaces the WMS GetLegendGraphic image that vector layers no longer have.
 */
export function StacRenderLegend({ layer }: { layer: PMTilesLayerProps }) {
    const searchSymbology = (useSearch({ strict: false }) as { vector_symbology?: Record<string, string> }).vector_symbology
    const render = activeRenderOf(layer, searchSymbology?.[layer.title || ''])
    const entries = render?.legend ?? []
    const allShaped = entries.length > 0 && entries.every(e => e.shape != null)
    // Same query the map draws from, so this is normally a cache hit. Skip when there are no
    // entries or every entry already declares its own swatch shape in STAC.
    const { data: fragment, isLoading } = useQuery(
        styleFragmentQueryOptions(entries.length > 0 && !allShaped ? render?.styleUrl : undefined),
    )

    if (entries.length === 0) {
        return <div className="px-1 py-1 text-xs text-muted-foreground italic">No legend available</div>
    }
    // Swatch shape comes from the fragment when entries don't author one explicitly, so wait
    // briefly rather than flash dots first; if fragment fetch fails, fall back to safe default.
    if (!allShaped && isLoading) {
        return <div className="px-1 py-1 text-xs text-muted-foreground">Loading legend...</div>
    }

    const shape = swatchShapeOf(fragment?.layers?.map(l => l.type) ?? [])

    return (
        <LegendSwatchGrid
            columns="single"
            shape={shape}
            items={entries.map(e => ({ key: e.value ?? e.label, label: e.label, color: e.color, stroke: e.stroke, shape: e.shape }))}
        />
    )
}
