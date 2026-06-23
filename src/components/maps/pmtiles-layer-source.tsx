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

interface StyleFragmentLayer {
    id: string
    type: maplibregl.LayerSpecification['type']
    layout?: Record<string, unknown>
    paint?: Record<string, unknown>
    'source-layer'?: string
    filter?: unknown
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

    // Icon renders ship a sprite the base style lacks; load it once per render.
    useEffect(() => {
        if (!render?.sprite || !mapRef) return
        const map = mapRef.getMap()
        try {
            const existing = (map.getSprite() as Array<{ id: string }> | undefined) ?? []
            if (!existing.some(s => s.id === render.id)) {
                map.addSprite(render.id, spriteUrl(render.sprite))
            }
        } catch (err) {
            console.warn(`[PMTilesLayerSource] sprite load failed for ${layer.title}/${render.id}:`, err)
        }
    }, [render, mapRef, layer.title])

    const styleLayers = (fragment.layers ?? []).filter(l => l['source-layer'] == null || l['source-layer'] === layer.sourceLayer)
    const primaryId = getPmtilesLayerId(layer)

    return (
        <Source id={sourceId} type="vector" url={url}>
            {styleLayers.map((l, i) => {
                const fragmentFilter = l.filter as maplibregl.FilterSpecification | undefined
                const filters = [fragmentFilter, layerFilter].filter(Boolean) as maplibregl.FilterSpecification[]
                const filter = filters.length === 2 ? (['all', ...filters] as unknown as maplibregl.FilterSpecification) : filters[0]
                const spec = {
                    id: i === 0 ? primaryId : `${primaryId}-${i}`,
                    type: l.type,
                    source: sourceId,
                    'source-layer': l['source-layer'] ?? layer.sourceLayer,
                    layout: { ...(l.layout ?? {}), visibility: hidden ? 'none' : 'visible' },
                    paint: withOpacity(l.paint, l.type, opacity ?? layer.opacity),
                    ...(filter ? { filter } : {}),
                    metadata: { title: layer.title, pmtilesLayer: true, pmtilesSourceId: sourceId },
                } as LayerProps
                return <Layer key={spec.id} beforeId={beforeId} {...spec} />
            })}
        </Source>
    )
}
