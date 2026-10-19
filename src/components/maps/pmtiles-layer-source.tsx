/**
 * Live PMTiles vector rendering for react-map-gl.
 *
 * The app renders vector layers declaratively (Source/Layer) — but had no
 * `pmtiles` path. This adds one: a vector `<Source>` pointed at a `.pmtiles`
 * archive over the `pmtiles://` protocol (HTTP range requests, no tile server),
 * plus `<Layer>`s built from the active STAC render's style fragment.
 *
 * Multiple renders (Purpose / Box Type …) are handled by picking the active one
 * from `vector_symbology` and mounting that fragment's layers — switching
 * symbology just swaps which fragment renders (declarative, no imperative
 * restyle). Sprites for icon renders are loaded on demand.
 */
import { useEffect } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Source, Layer, useMap, type LayerProps } from 'react-map-gl/maplibre'
import type maplibregl from 'maplibre-gl'
import type { PMTilesLayerProps, PMTilesRender } from '@/lib/types/mapping-types'
import { buildFragmentLayerSpec } from '@/lib/map/layer-utils'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'

interface StyleFragmentLayer {
    id: string
    type: maplibregl.LayerSpecification['type']
    layout?: Record<string, unknown>
    paint?: Record<string, unknown>
    'source-layer'?: string
    filter?: unknown
    /** Zoom gate authored in ugs-styles (PLSS draws only when zoomed in). */
    minzoom?: number
    maxzoom?: number
    /** Anything else the fragment authors is carried through untouched. */
    [key: string]: unknown
}
interface StyleFragment { layers?: StyleFragmentLayer[] }

/** Stable source id per PMTiles layer (kept simple + greppable). */
export function getPmtilesSourceId(layer: PMTilesLayerProps): string {
    return `pmtiles-${layer.title || layer.sourceLayer}`.replace(/\s+/g, '-').toLowerCase()
}

/**
 * Canonical first-layer id for z-order (`beforeId`) lookups. Independent of the
 * fragment so the value is known before the style loads. The first rendered
 * sublayer takes this id; extras are suffixed.
 */
export function getPmtilesLayerId(layer: PMTilesLayerProps): string {
    return `pmtiles-layer-${layer.title}`
}

/** Renders available for a layer: explicit STAC renders, or a single styleUrl. */
function rendersOf(layer: PMTilesLayerProps): PMTilesRender[] {
    if (layer.renders && layer.renders.length > 0) return layer.renders
    if (layer.styleUrl) return [{ id: '__single', styleUrl: layer.styleUrl }]
    return []
}

/** The render to draw, given the active symbology selection. */
export function activeRenderOf(layer: PMTilesLayerProps, activeSymbology?: string): PMTilesRender | undefined {
    const renders = rendersOf(layer)
    const id = activeSymbology || layer.defaultRenderId || renders[0]?.id
    return renders.find(r => r.id === id) ?? renders[0]
}

/**
 * Fetch the active render's style fragment for each mounted PMTiles layer.
 * Mirrors `useWfsLayerData`: the parent gates mounting on readiness so a layer's
 * `<Source>` (and its canonical id) only appears once its fragment is loaded,
 * keeping `beforeId` z-ordering valid.
 */
export function usePMTilesStyleFragments(
    layers: PMTilesLayerProps[],
    vectorLayerSymbology: Record<string, string>,
): Map<string, StyleFragment> {
    const queries = useQueries({
        queries: layers.map(layer => {
            const render = activeRenderOf(layer, vectorLayerSymbology[layer.title || ''])
            return {
                queryKey: ['pmtiles-style-fragment', render?.styleUrl ?? ''],
                queryFn: async (): Promise<StyleFragment> => {
                    const res = await fetch(render!.styleUrl)
                    if (!res.ok) throw new Error(`PMTiles style fetch failed: ${res.status}`)
                    return res.json()
                },
                enabled: !!render?.styleUrl,
                staleTime: Infinity,
            }
        }),
    })
    const out = new Map<string, StyleFragment>()
    layers.forEach((layer, i) => {
        const data = queries[i]?.data
        if (data && layer.title) out.set(layer.title, data)
    })
    return out
}

function spriteUrl(sprite: string): string {
    return sprite.startsWith('http') ? sprite : `${window.location.origin}${sprite}`
}

interface SpriteEntry { x: number; y: number; width: number; height: number; pixelRatio?: number }

/**
 * Load a baked sprite sheet (`<base>.json` + `<base>.png`) and register each
 * icon under its BARE name via `map.addImage`. The warehouse styles reference
 * icons by un-namespaced ids (e.g. `box-type-CORE,CUTTINGS`), so MapLibre's
 * `addSprite` (which namespaces as `id:icon`) can't satisfy them — we slice the
 * sheet ourselves. Idempotent: existing images are skipped.
 */
async function loadSpriteSheet(map: maplibregl.Map, base: string): Promise<void> {
    const url = spriteUrl(base)
    const [json, blob] = await Promise.all([
        fetch(`${url}.json`).then(r => { if (!r.ok) throw new Error(`sprite json ${r.status}`); return r.json() as Promise<Record<string, SpriteEntry>> }),
        fetch(`${url}.png`).then(r => { if (!r.ok) throw new Error(`sprite png ${r.status}`); return r.blob() }),
    ])
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    for (const [name, s] of Object.entries(json)) {
        if (map.hasImage(name)) continue
        canvas.width = s.width
        canvas.height = s.height
        ctx.clearRect(0, 0, s.width, s.height)
        ctx.drawImage(bitmap, s.x, s.y, s.width, s.height, 0, 0, s.width, s.height)
        try {
            map.addImage(name, ctx.getImageData(0, 0, s.width, s.height), { pixelRatio: s.pixelRatio ?? 1 })
        } catch { /* concurrent add — ignore */ }
    }
}

/** Type + first coordinate — enough to tell co-located-attribute features apart when a source carries no ids. */
function geometrySignature(geometry: GeoJSON.Geometry): string {
    if (geometry.type === 'GeometryCollection') return `GeometryCollection:${geometry.geometries.length}`
    let c: unknown = geometry.coordinates
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0]
    return `${geometry.type}:${Array.isArray(c) ? c.join(',') : ''}`
}

/**
 * Query rendered PMTiles features in a screen bbox, mapped to the same
 * `WfsLayerFeature` shape the popup pipeline consumes. Mirrors
 * `queryWfsLayersInScreenBbox`: it walks every rendered layer tagged
 * `metadata.pmtilesLayer` whose title is among the visible PMTiles layers (a
 * single layer may render as many style sublayers), then dedupes per layer.
 */
export function queryPmtilesLayersInScreenBbox(
    map: maplibregl.Map,
    bbox: [maplibregl.PointLike, maplibregl.PointLike],
    layers: PMTilesLayerProps[],
): WfsLayerFeature[] {
    if (layers.length === 0) return []
    const titles = new Set(layers.map(l => l.title))
    const ids = (map.getStyle().layers ?? [])
        .filter(l => {
            const md = l.metadata as { pmtilesLayer?: boolean; title?: string } | undefined
            return md?.pmtilesLayer && !!md.title && titles.has(md.title) && !!map.getLayer(l.id)
        })
        .map(l => l.id)
    if (ids.length === 0) return []

    const out: WfsLayerFeature[] = []
    const seen = new Set<string>()
    for (const f of map.queryRenderedFeatures(bbox, { layers: ids })) {
        const md = map.getLayer(f.layer.id)?.metadata as { title?: string } | undefined
        const layerTitle = md?.title || 'Unknown Layer'
        const id = f.id ?? (f.properties?.ogc_fid as string | number | undefined) ?? 0
        // A single feature comes back many times over an area: once per tile it straddles,
        // and once per style sublayer of the same layer. Dedupe on the best identity we have —
        // an unkeyed source falls back to properties + a geometry signature, so two features
        // that merely share attributes (same box type, different well) stay distinct.
        const key = `${layerTitle}|${id || `${JSON.stringify(f.properties)}|${geometrySignature(f.geometry)}`}`
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

/** Screen-tolerance box around a click point. See {@link queryPmtilesLayersInScreenBbox}. */
export function queryPmtilesLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    layers: PMTilesLayerProps[],
): WfsLayerFeature[] {
    return queryPmtilesLayersInScreenBbox(map, [
        [point.x - tolerance, point.y - tolerance],
        [point.x + tolerance, point.y + tolerance],
    ], layers)
}

const OPACITY_PROP: Record<string, string> = {
    circle: 'circle-opacity',
    line: 'line-opacity',
    fill: 'fill-opacity',
    symbol: 'icon-opacity',
    'fill-extrusion': 'fill-extrusion-opacity',
}

/** Apply the layer's opacity-slider override onto a fragment layer's paint. */
function withOpacity(paint: Record<string, unknown> | undefined, type: string, opacity: number | undefined): Record<string, unknown> {
    const out = { ...(paint ?? {}) }
    if (opacity == null) return out
    const key = OPACITY_PROP[type]
    if (key) out[key] = opacity
    if (type === 'circle') out['circle-stroke-opacity'] = opacity
    if (type === 'symbol') out['text-opacity'] = opacity
    return out
}

/**
 * Build the MapLibre layer specs for one PMTiles layer's active style fragment.
 *
 * Every fragment property survives — notably the `minzoom`/`maxzoom` ugs-styles
 * authors (PLSS sections are gated to ~z11); only viewer-owned fields are
 * overridden. A config `visibleZoomRange` wins over the fragment's own zoom.
 * Kept separate from the JSX so the mapping is unit-testable. [ALL-5727]
 */
export function buildPmtilesLayerSpecs({
    layer, fragment, layerFilter, hidden, opacity,
}: {
    layer: PMTilesLayerProps
    fragment: StyleFragment
    layerFilter?: maplibregl.FilterSpecification
    hidden?: boolean
    opacity?: number
}): LayerProps[] {
    const sourceId = getPmtilesSourceId(layer)
    const primaryId = getPmtilesLayerId(layer)
    const styleLayers = (fragment.layers ?? []).filter(
        l => l['source-layer'] == null || l['source-layer'] === layer.sourceLayer,
    )

    return styleLayers.map((l, i) => {
        const fragmentFilter = l.filter as maplibregl.FilterSpecification | undefined
        const filters = [fragmentFilter, layerFilter].filter(Boolean) as maplibregl.FilterSpecification[]
        const filter = filters.length === 2 ? (['all', ...filters] as unknown as maplibregl.FilterSpecification) : filters[0]
        return buildFragmentLayerSpec(l, {
            layerId: i === 0 ? primaryId : `${primaryId}-${i}`,
            sourceId,
            sourceLayer: layer.sourceLayer,
            visible: !hidden,
            paint: withOpacity(l.paint, l.type, opacity ?? layer.opacity),
            filter,
            metadata: { title: layer.title, pmtilesLayer: true, pmtilesSourceId: sourceId },
            visibleZoomRange: layer.visibleZoomRange,
        }) as unknown as LayerProps
    })
}

export function PMTilesLayerSource({
    layer, fragment, activeSymbology, beforeId, layerFilter, hidden, opacity,
}: {
    layer: PMTilesLayerProps
    fragment: StyleFragment
    activeSymbology?: string
    beforeId?: string
    layerFilter?: maplibregl.FilterSpecification
    hidden?: boolean
    opacity?: number
}) {
    const { current: mapRef } = useMap()
    const sourceId = getPmtilesSourceId(layer)
    const render = activeRenderOf(layer, activeSymbology)
    const url = layer.pmtilesUrl.startsWith('http')
        ? `pmtiles://${layer.pmtilesUrl}`
        : `pmtiles://${window.location.origin}${layer.pmtilesUrl}`

    // Icon renders ship a baked sprite sheet the base style lacks; slice it and
    // register each icon under its bare name so `icon-image` resolves.
    useEffect(() => {
        if (!render?.sprite || !mapRef) return
        const map = mapRef.getMap()
        loadSpriteSheet(map, render.sprite).catch(err =>
            console.warn(`[PMTilesLayerSource] sprite load failed for ${layer.title}/${render.id}:`, err),
        )
    }, [render, mapRef, layer.title])

    const specs = buildPmtilesLayerSpecs({ layer, fragment, layerFilter, hidden, opacity })

    return (
        <Source id={sourceId} type="vector" url={url}>
            {specs.map(spec => (
                <Layer key={spec.id} beforeId={beforeId} {...spec} />
            ))}
        </Source>
    )
}
