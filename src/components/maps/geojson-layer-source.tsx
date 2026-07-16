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
import { colorFromTitle } from '@/lib/map/user-layers/detect'

/** Stable source id per GeoJSON layer. */
export function getGeojsonSourceId(layer: GeoJSONLayerProps): string {
    return `geojson-${layer.title}`.replace(/\s+/g, '-').toLowerCase()
}

/** Canonical first-sublayer id for z-order (`beforeId`) lookups. */
export function getGeojsonLayerId(layer: GeoJSONLayerProps): string {
    return `geojson-layer-${layer.title}`
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
        <Source id={sourceId} type="geojson" data={data}>
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
