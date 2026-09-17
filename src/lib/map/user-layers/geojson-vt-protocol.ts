/**
 * Client-side vector tiling for large user vector layers.
 *
 * A Parquet layer's polygons and lines arrive as one big FeatureCollection.
 * Handing that to a renderer whole means every feature is tessellated up front,
 * whatever is on screen — which is what makes a large file stutter on pan and
 * zoom. Instead we build a `GeoJSONVT` index in the browser (the same tiler
 * MapLibre uses internally for its own geojson sources), encode each requested
 * tile to MVT with `vt-pbf`, and serve it through a custom MapLibre protocol.
 * The layer then behaves like any other vector-tile source: MapLibre asks for
 * the tiles it needs at the zoom it is at, and the tiler culls and simplifies
 * per tile on demand.
 *
 * Note this fixes draw cost, not memory — the index still holds the whole
 * collection. The row-count guard in `parquet-deck-loader` covers that side.
 *
 * Modeled on GeoLibre's `geojson-vt-protocol.ts`, which solves the same problem
 * the same way.
 */
import maplibregl from 'maplibre-gl'
import { GeoJSONVT, type GeoJSONVTTile } from '@maplibre/geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'

/** Custom protocol scheme handled by {@link ensureGeoJsonVtProtocol}. */
export const GEOJSONVT_PROTOCOL = 'ugs-gjvt'

/** The single source-layer name carried by every generated tile. Render layers
 *  reference this via their `source-layer`. */
export const TILE_SOURCE_LAYER = 'data'

/** Tile extent shared by the index builder and the MVT encoder. */
const TILE_EXTENT = 4096

/** Highest zoom the index is built for; MapLibre over-zooms past it. Exported
 *  so the source's `maxzoom` can't drift from the index. */
export const TILE_MAX_ZOOM = 16

interface RegistryEntry {
    index: { getTile(z: number, x: number, y: number): GeoJSONVTTile | null }
    /** The collection last indexed — used to detect data changes. */
    geojsonRef: GeoJSON.FeatureCollection
    /** Bumped on every rebuild so the caller can force MapLibre to drop cached tiles. */
    rev: number
}

// Module-level: tile indexes are large, non-serializable objects that must not
// enter React state or the URL.
const registry = new Map<string, RegistryEntry>()

/**
 * Build (or rebuild) the tile index backing a layer's vector source.
 *
 * Rebuilds only when there is no index yet or the collection's object identity
 * changed. Returns the entry's revision — a caller that folds this into its
 * source id gets a fresh source (and so a tile refetch) exactly when the index
 * actually changed.
 */
export function registerGeoJsonVtSource(key: string, geojson: GeoJSON.FeatureCollection): number {
    const existing = registry.get(key)
    if (existing && existing.geojsonRef === geojson) return existing.rev

    const index = new GeoJSONVT(geojson, {
        maxZoom: TILE_MAX_ZOOM,
        extent: TILE_EXTENT,
        buffer: 64,
        tolerance: 3,
    })
    const rev = (existing?.rev ?? 0) + 1
    registry.set(key, { index, geojsonRef: geojson, rev })
    return rev
}

/** Drop a layer's tile index. Safe to call when none is registered. */
export function unregisterGeoJsonVtSource(key: string): void {
    registry.delete(key)
}

/** The `tiles` template for a layer's vector source. */
export function geojsonVtTileUrl(key: string): string {
    return `${GEOJSONVT_PROTOCOL}://${encodeURIComponent(key)}/{z}/{x}/{y}`
}

/**
 * Register the protocol once. Re-registers after a `setStyle()` clears
 * MapLibre's protocol table, which is why this checks the live registry rather
 * than a module boolean.
 */
export function ensureGeoJsonVtProtocol(): void {
    const registered = (maplibregl.config as unknown as { REGISTERED_PROTOCOLS?: Record<string, unknown> })
        .REGISTERED_PROTOCOLS?.[GEOJSONVT_PROTOCOL]
    if (registered) return
    maplibregl.addProtocol(GEOJSONVT_PROTOCOL, geojsonVtProtocolHandler)
}

async function geojsonVtProtocolHandler(
    params: maplibregl.RequestParameters,
    abortController?: AbortController,
): Promise<{ data: ArrayBuffer }> {
    const tile = lookupTile(params.url)
    if (!tile) return { data: new ArrayBuffer(0) }
    // MapLibre cancels tiles scrolled off-screen; skip the CPU-heavy encode when
    // the request was already aborted, since the result would be discarded.
    if (abortController?.signal.aborted) return { data: new ArrayBuffer(0) }
    try {
        // vt-pbf bundles an older geojson-vt whose tile type differs nominally
        // from ours; the runtime shapes match, so cast at the encode boundary.
        // The catch guards that compatibility ever breaking — an empty tile beats
        // an unhandled rejection that silently blanks the layer.
        const pbf = fromGeojsonVt(
            { [TILE_SOURCE_LAYER]: tile } as unknown as Parameters<typeof fromGeojsonVt>[0],
            { version: 2, extent: TILE_EXTENT },
        )
        // Hand MapLibre an exactly-sized buffer; `pbf` may be a view into a larger one.
        return {
            data: pbf.buffer.slice(pbf.byteOffset, pbf.byteOffset + pbf.byteLength) as ArrayBuffer,
        }
    } catch (e) {
        console.warn('[user-layers] geojson-vt tile encode failed:', e)
        return { data: new ArrayBuffer(0) }
    }
}

/** Parse `ugs-gjvt://<key>/<z>/<x>/<y>` and return the tile, or null when the
 *  layer is unknown or the tile is empty / out of range. */
function lookupTile(url: string): GeoJSONVTTile | null {
    const path = url.slice(`${GEOJSONVT_PROTOCOL}://`.length)
    const slash = path.indexOf('/')
    if (slash < 0) return null
    let key: string
    try {
        key = decodeURIComponent(path.slice(0, slash))
    } catch {
        return null
    }
    const [z, x, y] = path.slice(slash + 1).split('/').map(Number)
    const entry = registry.get(key)
    if (!entry || !Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null
    return entry.index.getTile(z, x, y)
}
