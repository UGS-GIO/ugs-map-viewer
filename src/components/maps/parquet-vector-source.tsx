/**
 * Tiled rendering for a Parquet layer's polygons and lines.
 *
 * The rows arrive as one FeatureCollection, which is too much to hand a
 * renderer whole. It is indexed and served as vector tiles instead — see
 * {@link ../../lib/map/user-layers/geojson-vt-protocol} — so this mounts a plain
 * `type: "vector"` source and the same fill/line/circle triple the user GeoJSON
 * path uses, differing only in carrying a `source-layer`.
 *
 * Point-only Parquet layers do NOT come through here: they go to the Deck.gl
 * overlay, which pushes their coordinates to the GPU as a binary attribute
 * without ever building features.
 */
import { useEffect, useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type maplibregl from 'maplibre-gl'
import type { ParquetLayerProps } from '@/lib/types/mapping-types'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import { colorFromTitle } from '@/lib/map/user-layers/detect'
import { queryTaggedVectorLayersAtPoint } from '@/components/maps/geojson-layer-source'
import {
    ensureGeoJsonVtProtocol,
    geojsonVtTileUrl,
    registerGeoJsonVtSource,
    unregisterGeoJsonVtSource,
    TILE_MAX_ZOOM,
    TILE_SOURCE_LAYER,
} from '@/lib/map/user-layers/geojson-vt-protocol'

/** Style-layer metadata flag used to find these layers when picking. */
const META_FLAG = 'userParquetVector'

/** Whether this Parquet layer renders through the tiled path (vs. the Deck.gl
 *  binary point path). */
export function isTiledParquetLayer(layer: ParquetLayerProps): boolean {
    return layer.deckData?.kind === 'geojson' && !!layer.deckData.geojson
}

/** Tile-index registry key for a layer. */
function indexKey(layer: ParquetLayerProps): string {
    return `parquet-${layer.title}`
}

/** Canonical first-sublayer id for z-order (`beforeId`) lookups. */
export function getParquetVectorLayerId(layer: ParquetLayerProps): string {
    return `parquet-vt-layer-${layer.title}`
}

/** Query rendered tiled-Parquet features at a point. */
export function queryParquetVectorLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    layers: ParquetLayerProps[],
): WfsLayerFeature[] {
    return queryTaggedVectorLayersAtPoint(
        map,
        point,
        tolerance,
        new Set(layers.map(l => l.title)),
        META_FLAG,
    )
}

export function ParquetVectorSource({
    layer, beforeId, hidden, opacity,
}: {
    layer: ParquetLayerProps
    beforeId?: string
    hidden?: boolean
    opacity?: number
}) {
    const key = indexKey(layer)
    const fc = layer.deckData?.geojson

    // Build the index during render, before the `<Source>` below mounts: on a
    // miss the protocol has nothing to answer with and MapLibre caches an empty
    // tile. `registerGeoJsonVtSource` is idempotent on the collection's identity,
    // so this only does work when the data actually changed.
    const rev = useMemo(() => (fc ? registerGeoJsonVtSource(key, fc) : 0), [key, fc])

    // Re-register on mount, not just unregister on unmount: StrictMode runs
    // mount -> cleanup -> mount, and the `useMemo` above does not re-run, so a
    // cleanup-only effect leaves the registry empty and every tile comes back
    // blank. Registration is idempotent on the collection's identity.
    useEffect(() => {
        if (fc) registerGeoJsonVtSource(key, fc)
        return () => unregisterGeoJsonVtSource(key)
    }, [key, fc])

    if (!fc) return null
    ensureGeoJsonVtProtocol()

    // The revision is part of the source id so a rebuilt index remounts the
    // source, which is what evicts MapLibre's cached tiles from the old data.
    const sourceId = `parquet-vt-${rev}-${key}`
    const primaryId = getParquetVectorLayerId(layer)
    const color = layer.color ?? colorFromTitle(layer.title)
    const visibility = (hidden ? 'none' : 'visible') as 'none' | 'visible'
    const o = opacity ?? layer.opacity
    const md = { title: layer.title, [META_FLAG]: true }

    return (
        <Source
            id={sourceId}
            type="vector"
            tiles={[geojsonVtTileUrl(key)]}
            minzoom={0}
            maxzoom={TILE_MAX_ZOOM}
        >
            <Layer
                id={`${primaryId}-fill`}
                beforeId={beforeId}
                type="fill"
                source={sourceId}
                source-layer={TILE_SOURCE_LAYER}
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
                source-layer={TILE_SOURCE_LAYER}
                layout={{ visibility }}
                paint={{ 'line-color': color, 'line-width': 1.4, 'line-opacity': o ?? 1 }}
                metadata={md}
            />
            <Layer
                id={`${primaryId}-circle`}
                beforeId={beforeId}
                type="circle"
                source={sourceId}
                source-layer={TILE_SOURCE_LAYER}
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
