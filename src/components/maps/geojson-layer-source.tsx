/**
 * Declarative GeoJSON rendering for react-map-gl.
 *
 * Backs user-added GeoJSON layers (by URL or uploaded file). Data comes from
 * either `geojsonUrl` (MapLibre fetches it) or inline `data` (uploads hydrated
 * from IndexedDB). Rendered generically as fill + line + circle sublayers keyed
 * off geometry type, so one layer handles mixed geometries. Colour is the
 * layer's `color` (or a hash of its title).
 */
import { Source, Layer } from 'react-map-gl/maplibre'
import type maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { GeoJSONLayerProps } from '@/lib/types/mapping-types'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import { colorFromTitle } from '@/lib/map/user-layers/detect'

/** Stable source id per GeoJSON layer. */
export function getGeojsonSourceId(layer: GeoJSONLayerProps): string {
    return `geojson-${layer.title}`.replace(/\s+/g, '-').toLowerCase()
}

/** Canonical first-sublayer id for z-order (`beforeId`) lookups. */
export function getGeojsonLayerId(layer: GeoJSONLayerProps): string {
    return `geojson-layer-${layer.title}`
}

/**
 * Query rendered user-GeoJSON features at a point (with screen tolerance), mapped
 * to the `WfsLayerFeature` shape the popup pipeline consumes. Mirrors
 * {@link queryPmtilesLayersAtPoint}: walks every rendered layer tagged
 * `metadata.userGeojson` whose title is among the visible GeoJSON layers.
 *
 * Deduped per (layer, feature id) because one polygon renders in BOTH the fill
 * and line sublayers and would otherwise show up twice in the popup.
 */
export function queryGeojsonLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    layers: GeoJSONLayerProps[],
): WfsLayerFeature[] {
    if (layers.length === 0) return []
    const titles = new Set(layers.map(l => l.title))
    const ids = (map.getStyle().layers ?? [])
        .filter(l => {
            const meta = l.metadata as { userGeojson?: boolean; title?: string } | undefined
            return meta?.userGeojson && !!meta.title && titles.has(meta.title) && !!map.getLayer(l.id)
        })
        .map(l => l.id)
    if (ids.length === 0) return []

    const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - tolerance, point.y - tolerance],
        [point.x + tolerance, point.y + tolerance],
    ]

    const seen = new Set<string>()
    const out: WfsLayerFeature[] = []
    for (const f of map.queryRenderedFeatures(bbox, { layers: ids })) {
        const meta = map.getLayer(f.layer.id)?.metadata as { title?: string } | undefined
        const layerTitle = meta?.title || 'Unknown Layer'
        const id = f.id ?? 0
        const key = `${layerTitle}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
            id,
            properties: f.properties as Record<string, unknown>,
            geometry: f.geometry,
            layerTitle,
        })
    }
    return out
}

export function GeoJSONLayerSource({
    layer, beforeId, hidden, opacity,
}: {
    layer: GeoJSONLayerProps
    beforeId?: string
    hidden?: boolean
    opacity?: number
}) {
    const sourceId = getGeojsonSourceId(layer)
    const primaryId = getGeojsonLayerId(layer)
    const color = layer.color ?? colorFromTitle(layer.title)
    const visibility = (hidden ? 'none' : 'visible') as 'none' | 'visible'
    const o = opacity ?? layer.opacity
    // `data` accepts a URL string or an inline FeatureCollection.
    const data = (layer.geojsonUrl ?? layer.data) as string | FeatureCollection | undefined
    if (!data) return null

    const md = { title: layer.title, userGeojson: true }

    return (
        // `generateId` gives features stable numeric ids — needed for popup dedupe
        // (a polygon renders in both the fill and line sublayers) and for selection.
        <Source id={sourceId} type="geojson" data={data} generateId>
            <Layer
                id={`${primaryId}-fill`}
                beforeId={beforeId}
                type="fill"
                source={sourceId}
                filter={['==', ['geometry-type'], 'Polygon'] as unknown as maplibregl.FilterSpecification}
                layout={{ visibility }}
                paint={{ 'fill-color': color, 'fill-opacity': o ?? 0.35 }}
                metadata={md}
            />
            <Layer
                id={primaryId}
                beforeId={beforeId}
                type="line"
                source={sourceId}
                layout={{ visibility }}
                paint={{ 'line-color': color, 'line-width': 1.4, 'line-opacity': o ?? 1 }}
                metadata={md}
            />
            <Layer
                id={`${primaryId}-circle`}
                beforeId={beforeId}
                type="circle"
                source={sourceId}
                filter={['==', ['geometry-type'], 'Point'] as unknown as maplibregl.FilterSpecification}
                layout={{ visibility }}
                paint={{
                    'circle-radius': 4,
                    'circle-color': color,
                    'circle-opacity': o ?? 1,
                    'circle-stroke-color': '#fff',
                    'circle-stroke-width': 1,
                }}
                metadata={md}
            />
        </Source>
    )
}
