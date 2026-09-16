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

/** Stable source id per GeoJSON layer. Hashed rather than slugified: lowercasing
 *  and collapsing whitespace would map "My Data" and "my-data" onto one id, and
 *  user layer titles are free text. */
export function getGeojsonSourceId(layer: GeoJSONLayerProps): string {
    let h = 0
    for (let i = 0; i < layer.title.length; i++) h = (h * 31 + layer.title.charCodeAt(i)) >>> 0
    return `geojson-${h.toString(36)}`
}

/** Canonical first-sublayer id for z-order (`beforeId`) lookups. */
export function getGeojsonLayerId(layer: GeoJSONLayerProps): string {
    return `geojson-layer-${layer.title}`
}

/** Type + first coordinate — enough to tell co-located-attribute features apart when a source carries no ids. */
function geometrySignature(geometry: GeoJSON.Geometry): string {
    if (geometry.type === 'GeometryCollection') return `GeometryCollection:${geometry.geometries.length}`
    let c: unknown = geometry.coordinates
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
    return `${geometry.type}:${Array.isArray(c) ? c.join(',') : ''}`
}

/**
 * Query rendered features at a point (with screen tolerance) across every style
 * layer tagged with `metadata[metaFlag]` whose `metadata.title` is in `titles`,
 * mapped to the `WfsLayerFeature` shape the popup pipeline consumes.
 *
 * Deduped per (layer, feature) because one polygon renders in BOTH the fill and
 * line sublayers and would otherwise show up twice in the popup.
 *
 * Shared by user GeoJSON layers and tiled Parquet layers — both render as a
 * generic fill/line/circle triple and differ only in their source type.
 */
export function queryTaggedVectorLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    titles: Set<string>,
    metaFlag: string,
): WfsLayerFeature[] {
    if (titles.size === 0) return []
    const ids = (map.getStyle().layers ?? [])
        .filter(l => {
            const meta = l.metadata as Record<string, unknown> | undefined
            const title = meta?.title
            return !!meta?.[metaFlag] && typeof title === 'string' && titles.has(title) && !!map.getLayer(l.id)
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
        const id = f.id ?? (f.properties?.id as string | number | undefined) ?? 0
        const key = `${layerTitle}|${id || `${JSON.stringify(f.properties)}|${geometrySignature(f.geometry)}`}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
            id: id || key,
            properties: f.properties as Record<string, unknown>,
            geometry: f.geometry,
            layerTitle,
        })
    }
    return out
}

/** Query rendered user-GeoJSON features at a point. See {@link queryTaggedVectorLayersAtPoint}. */
export function queryGeojsonLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    layers: GeoJSONLayerProps[],
): WfsLayerFeature[] {
    return queryTaggedVectorLayersAtPoint(map, point, tolerance, new Set(layers.map(l => l.title)), 'userGeojson')
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
