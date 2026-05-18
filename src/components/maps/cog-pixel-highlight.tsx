import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import { useCogMetadata, computeCogPixelPolygon } from '@/hooks/use-cog-metadata'
import { HIGHLIGHT_COLORS } from '@/lib/map/cog/setup'
import type { COGLayerProps } from '@/lib/types/mapping-types'
import type { FeatureCollection, Polygon } from 'geojson'

/**
 * Highlights the actual COG pixel cell containing the click point.
 * Snaps to the COG's native grid (using resolution + origin from TIFF metadata)
 * so the user sees what was sampled, not just where they clicked.
 */
export function CogPixelHighlight({
    layer, clickPoint,
}: { layer: COGLayerProps; clickPoint: { lng: number; lat: number } | null }) {
    const { data: metadata } = useCogMetadata(layer.cogUrl)

    const cellGeoJson = useMemo<FeatureCollection<Polygon> | null>(() => {
        if (!clickPoint || !metadata) return null
        const polygon = computeCogPixelPolygon(clickPoint, metadata)
        if (!polygon) return null
        return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: polygon, properties: {} }] }
    }, [clickPoint, metadata])

    if (!cellGeoJson) return null

    const sourceId = `cog-pixel-${layer.title}`
    return (
        <Source id={sourceId} type="geojson" data={cellGeoJson}>
            <Layer id={`${sourceId}-fill`} type="fill" paint={{ 'fill-color': HIGHLIGHT_COLORS.cog, 'fill-opacity': 0.25 }} />
            <Layer id={`${sourceId}-line`} type="line" paint={{ 'line-color': HIGHLIGHT_COLORS.cog, 'line-width': 2 }} />
        </Source>
    )
}
