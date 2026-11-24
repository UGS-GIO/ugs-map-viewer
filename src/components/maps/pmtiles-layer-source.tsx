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
import { queryOptions, useQueries } from '@tanstack/react-query'
import { Source, Layer, useMap, type LayerProps } from 'react-map-gl/maplibre'
import type * as maplibregl from 'maplibre-gl'
import type { PMTilesLayerProps, PMTilesRender } from '@/lib/types/mapping-types'
import { buildFragmentLayerSpec } from '@/lib/map/layer-utils'
import { baseOpacityOf, scaledOpacityPaint } from '@/lib/map/scale-opacity'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import { labelDiff, toFeatureCollection, viewportLabelPoints, type LabelPoints } from '@/lib/map/viewport-labels'

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

/** The GeoJSON source a `polygonLabels` layer's symbol layers draw from. */
export function getPmtilesLabelSourceId(layer: PMTilesLayerProps): string {
    return `${getPmtilesSourceId(layer)}-labels`
}

const EMPTY_LABELS: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

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

const styleFragmentCache = new Map<string, Promise<StyleFragment>>()

export function fetchStyleFragment(styleUrl: string): Promise<StyleFragment> {
    let pending = styleFragmentCache.get(styleUrl)
    if (!pending) {
        pending = fetch(styleUrl)
            .then(res => {
                if (!res.ok) throw new Error(`PMTiles style fetch failed: ${res.status}`)
                return res.json() as Promise<StyleFragment>
            })
            .catch(err => {
                styleFragmentCache.delete(styleUrl)
                throw err
            })
        styleFragmentCache.set(styleUrl, pending)
    }
    return pending
}

/** A render's style fragment. Shared so the legend reads the same cached fragment the map draws. */
export const styleFragmentQueryOptions = (styleUrl: string | undefined) => queryOptions({
    queryKey: ['pmtiles-style-fragment', styleUrl ?? ''],
    queryFn: async (): Promise<StyleFragment> => {
        if (!styleUrl) throw new Error('PMTiles render has no styleUrl')
        return fetchStyleFragment(styleUrl)
    },
    enabled: !!styleUrl,
    staleTime: Infinity,
})

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
            return styleFragmentQueryOptions(render?.styleUrl)
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
interface DecodedSpriteSlice { name: string; imageData: ImageData; pixelRatio: number }

const spriteSheetCache = new Map<string, Promise<DecodedSpriteSlice[]>>()

function fetchDecodedSpriteSheet(url: string): Promise<DecodedSpriteSlice[]> {
    let pending = spriteSheetCache.get(url)
    if (!pending) {
        pending = (async () => {
            const [json, blob] = await Promise.all([
                fetch(`${url}.json`).then(r => { if (!r.ok) throw new Error(`sprite json ${r.status}`); return r.json() as Promise<Record<string, SpriteEntry>> }),
                fetch(`${url}.png`).then(r => { if (!r.ok) throw new Error(`sprite png ${r.status}`); return r.blob() }),
            ])
            const bitmap = await createImageBitmap(blob)
            try {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                if (!ctx) return []
                const slices: DecodedSpriteSlice[] = []
                for (const [name, s] of Object.entries(json)) {
                    canvas.width = s.width
                    canvas.height = s.height
                    ctx.clearRect(0, 0, s.width, s.height)
                    ctx.drawImage(bitmap, s.x, s.y, s.width, s.height, 0, 0, s.width, s.height)
                    slices.push({
                        name,
                        imageData: ctx.getImageData(0, 0, s.width, s.height),
                        pixelRatio: s.pixelRatio ?? 1,
                    })
                }
                return slices
            } finally {
                bitmap.close()
            }
        })().catch(err => {
            spriteSheetCache.delete(url)
            throw err
        })
        spriteSheetCache.set(url, pending)
    }
    return pending
}

/**
 * Load a baked sprite sheet (`<base>.json` + `<base>.png`) and register each
 * icon under its BARE name via `map.addImage`. The warehouse styles reference
 * icons by un-namespaced ids (e.g. `box-type-CORE,CUTTINGS`), so MapLibre's
 * `addSprite` (which namespaces as `id:icon`) can't satisfy them — we slice the
 * sheet ourselves. Idempotent: existing images are skipped.
 */
async function loadSpriteSheet(map: maplibregl.Map, base: string, isCancelled?: () => boolean): Promise<void> {
    const slices = await fetchDecodedSpriteSheet(spriteUrl(base))
    if (isCancelled?.()) return
    for (const s of slices) {
        if (map.hasImage(s.name)) continue
        try {
            map.addImage(s.name, s.imageData, { pixelRatio: s.pixelRatio })
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

/** Apply the layer's opacity-slider override proportionally onto a fragment layer's paint. */
function withOpacity(paint: Record<string, unknown> | undefined, type: string, opacity: number | undefined): Record<string, unknown> {
    const out = { ...(paint ?? {}) }
    return opacity == null ? out : { ...out, ...Object.fromEntries(scaledOpacityPaint(paint, type, opacity)) }
}

export interface PMTilesStyleOverride {
    fillColor?: unknown
    paint?: Record<string, unknown>
}

function resolveLayersToRender(
    layer: PMTilesLayerProps,
    fragment: StyleFragment,
    styleOverride?: PMTilesStyleOverride,
): StyleFragmentLayer[] {
    const primaryId = getPmtilesLayerId(layer)
    const rawLayers = fragment.layers ?? []
    const styleLayers = rawLayers.filter(
        l => l['source-layer'] == null || l['source-layer'] === layer.sourceLayer,
    )

    let layersToRender = [...styleLayers]
    if (styleOverride?.fillColor) {
        const hasFill = layersToRender.some(l => l.type === 'fill')
        if (!hasFill) {
            const fillLayer: StyleFragmentLayer = {
                id: `${primaryId}-dynamic-fill`,
                type: 'fill',
                'source-layer': layer.sourceLayer,
                paint: {
                    'fill-color': styleOverride.fillColor,
                    'fill-opacity': 0.75,
                },
            }
            layersToRender = [fillLayer, ...layersToRender]
        }
    }

    return layersToRender.map(l => {
        let paint = l.paint
        if (styleOverride?.fillColor && l.type === 'fill') {
            paint = { ...paint, 'fill-color': styleOverride.fillColor }
        }
        if (styleOverride?.paint) {
            paint = { ...paint, ...styleOverride.paint }
        }
        return paint === l.paint ? l : { ...l, paint }
    })
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
    layer, fragment, layerFilter, hidden, opacity, styleOverride,
}: {
    layer: PMTilesLayerProps
    fragment: StyleFragment
    layerFilter?: maplibregl.FilterSpecification
    hidden?: boolean
    opacity?: number
    styleOverride?: PMTilesStyleOverride
}): LayerProps[] {
    const sourceId = getPmtilesSourceId(layer)
    const primaryId = getPmtilesLayerId(layer)
    const layersToRender = resolveLayersToRender(layer, fragment, styleOverride)

    return layersToRender.map((l, i) => {
        const fragmentFilter = l.filter as maplibregl.FilterSpecification | undefined
        const filters = [fragmentFilter, layer.featureFilter, layerFilter].filter(Boolean) as maplibregl.FilterSpecification[]
        const filter = filters.length > 1 ? (['all', ...filters] as unknown as maplibregl.FilterSpecification) : filters[0]

        const spec = buildFragmentLayerSpec(l, {
            layerId: i === 0 ? primaryId : `${primaryId}-${i}`,
            sourceId,
            sourceLayer: layer.sourceLayer,
            visible: !hidden,
            paint: withOpacity(l.paint, l.type, opacity ?? layer.opacity),
            filter,
            metadata: { title: layer.title, pmtilesLayer: true, pmtilesSourceId: sourceId, baseOpacity: baseOpacityOf(l.paint, l.type) },
            visibleZoomRange: layer.visibleZoomRange,
        })
        // Line-placed text follows the polygon's edge, which a label point doesn't have
        const placement = l.layout?.['symbol-placement'] ?? 'point'
        if (!layer.polygonLabels || l.type !== 'symbol' || placement !== 'point') return spec as unknown as LayerProps
        // Label points carry no source-layer, and stay out of the click query (they repeat the polygon).
        const { 'source-layer': _sourceLayer, ...labelSpec } = spec
        return { ...labelSpec, source: getPmtilesLabelSourceId(layer), metadata: { title: layer.title } } as unknown as LayerProps
    })
}

export function PMTilesLayerSource({
    layer, fragment, activeSymbology, beforeId, layerFilter, hidden, opacity, styleOverride,
}: {
    layer: PMTilesLayerProps
    fragment: StyleFragment
    activeSymbology?: string
    beforeId?: string
    layerFilter?: maplibregl.FilterSpecification
    hidden?: boolean
    opacity?: number
    styleOverride?: PMTilesStyleOverride
}) {
    const { current: mapRef } = useMap()
    const sourceId = getPmtilesSourceId(layer)
    const render = activeRenderOf(layer, activeSymbology)
    const url = layer.pmtilesUrl.startsWith('http')
        ? `pmtiles://${layer.pmtilesUrl}`
        : `pmtiles://${window.location.origin}${layer.pmtilesUrl}`

    // Icon and fill-pattern renders ship a baked sprite sheet the base style lacks;
    // slice it and register each image under its bare name, re-applying after basemap swaps.
    useEffect(() => {
        if (!render?.sprite || !mapRef) return
        const map = mapRef.getMap()
        const spriteBase = render.sprite
        let cancelled = false
        const register = () => {
            loadSpriteSheet(map, spriteBase, () => cancelled).catch(err =>
                console.warn(`[PMTilesLayerSource] sprite load failed for ${layer.title}/${render.id}:`, err),
            )
        }
        register()
        map.on('styledata', register)
        return () => {
            cancelled = true
            map.off('styledata', register)
        }
    }, [render, mapRef, layer.title])

    const labelSourceId = getPmtilesLabelSourceId(layer)
    useEffect(() => {
        if (!layer.polygonLabels || hidden || !mapRef) return
        const map = mapRef.getMap()
        let raf = 0
        let labels: LabelPoints = new Map()
        // react-map-gl re-adds the source empty after a basemap swap, so a new instance gets the full set
        let target: maplibregl.GeoJSONSource | undefined
        const update = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                const source = map.getSource<maplibregl.GeoJSONSource>(labelSourceId)
                if (!source || !map.getSource(sourceId)) return
                const b = map.getBounds()
                const pieces = map.querySourceFeatures(sourceId, { sourceLayer: layer.sourceLayer })
                const next = viewportLabelPoints(pieces, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], labels)
                // Only changed labels: a full setData re-places every label, which flashes on each pan
                const diff = source === target ? labelDiff(labels, next) : null
                if (source !== target) source.setData(toFeatureCollection(next))
                else if (diff) source.updateData(diff)
                target = source
                labels = next
            })
        }
        const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
            if (e.sourceId === sourceId && e.isSourceLoaded) update()
        }
        map.on('sourcedata', onSourceData)
        map.on('moveend', update)
        update()
        return () => {
            map.off('sourcedata', onSourceData)
            map.off('moveend', update)
            cancelAnimationFrame(raf)
        }
    }, [layer.polygonLabels, layer.sourceLayer, hidden, mapRef, sourceId, labelSourceId])

    const specs = buildPmtilesLayerSpecs({ layer, fragment, layerFilter, hidden, opacity, styleOverride })
    const isLabel = (spec: LayerProps) => 'source' in spec && spec.source === labelSourceId
    const labelSpecs = specs.filter(isLabel)

    return (
        <>
            <Source id={sourceId} type="vector" url={url}>
                {specs.filter(spec => !isLabel(spec)).map(spec => (
                    <Layer key={spec.id} beforeId={beforeId} {...spec} />
                ))}
            </Source>
            {labelSpecs.length > 0 && (
                <Source id={labelSourceId} type="geojson" data={EMPTY_LABELS}>
                    {labelSpecs.map(spec => (
                        <Layer key={spec.id} beforeId={beforeId} {...spec} />
                    ))}
                </Source>
            )}
        </>
    )
}
