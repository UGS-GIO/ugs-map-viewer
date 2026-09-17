/**
 * Deck.gl overlay for point-only Parquet layers: coordinates reach the GPU as
 * one binary attribute, with no per-feature object ever built, and picking goes
 * through Deck's GPU picker rather than a JS scan. Parquet polygons and lines
 * are tiled through MapLibre instead (see `parquet-vector-source.tsx`).
 */
import { useEffect, useRef, useMemo } from 'react'
import { useQueries, keepPreviousData } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import type { Layer as DeckLayer, PickingInfo } from '@deck.gl/core'
import type maplibregl from 'maplibre-gl'
import type { ParquetLayerProps } from '@/lib/types/mapping-types'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import { queryParquetRowProperties, queryPointsInViewport } from '@/lib/map/user-layers/parquet-deck-loader'
import { isRecord } from '@/lib/utils'
import type { ParquetPointView } from '@/lib/map/user-layers/parquet-deck-loader'

/** How far past the viewport to fetch, as a fraction of its size. Covers a
 *  small pan before the next slice lands. */
const VIEWPORT_PAD = 0.3

/**
 * The drawn slice, hung off the Deck layer itself so picking can resolve a
 * click's index from `info.layer` alone, with no state on the side to keep in
 * step.
 */
const POINT_VIEW_PROP = 'ugsPointView'

/** Deck types props as its own shape, so this is checked rather than asserted. */
function readPointView(props: unknown): ParquetPointView | undefined {
    if (!isRecord(props)) return undefined
    const view = props[POINT_VIEW_PROP]
    if (!isRecord(view)) return undefined
    const candidate = view
    return candidate.positions instanceof Float32Array
        && candidate.rowIds instanceof Int32Array
        && typeof candidate.count === 'number'
        && typeof candidate.inView === 'number'
        && typeof candidate.stride === 'number'
        ? { positions: candidate.positions, rowIds: candidate.rowIds, count: candidate.count, inView: candidate.inView, stride: candidate.stride }
        : undefined
}

/** Deck layer id for a Parquet layer. Shared with `data-map` so `beforeId`
 *  lookups and picking agree on one id per layer. */
export function getDeckLayerId(layer: ParquetLayerProps): string {
    return `deck-parquet-${layer.title}`
}

/** One picked point row: which layer, which row, and where it is. */
export interface ParquetPointHit {
    layer: ParquetLayerProps
    rowId: number
    lng: number
    lat: number
}

/**
 * Rows under a click. `depth` lets one click return a hit from each overlapping
 * layer. Only identifies rows — attributes come from DuckDB via
 * {@link hydrateParquetPointHits}.
 */
/** The slice of the Deck overlay picking needs. Structural, so a caller — or a
 *  test — can supply just the picker. */
export interface ParquetPicker {
    pickMultipleObjects: (opts: {
        x: number
        y: number
        radius?: number
        layerIds?: string[]
        depth?: number
    }) => PickingInfo[]
}

export function pickParquetPoints(
    overlay: ParquetPicker | null,
    point: { x: number; y: number },
    tolerance: number,
    layers: ParquetLayerProps[],
): ParquetPointHit[] {
    if (!overlay || layers.length === 0) return []

    const byId = new Map(layers.map(l => [getDeckLayerId(l), l]))
    let picks: PickingInfo[]
    try {
        picks = overlay.pickMultipleObjects({
            x: point.x,
            y: point.y,
            radius: tolerance,
            layerIds: [...byId.keys()],
            depth: byId.size,
        })
    } catch {
        // Picking reads the GPU; a lost context shouldn't break the click pipeline.
        return []
    }

    const out: ParquetPointHit[] = []
    const seenLayers = new Set<string>()
    for (const info of picks) {
        const layerId = info.layer?.id
        const layer = layerId ? byId.get(layerId) : undefined
        // One hit per layer — Deck returns them nearest-first.
        if (!layer || seenLayers.has(layer.title)) continue

        const view = readPointView(info.layer?.props)
        const i = info.index
        if (!view || i < 0 || i >= view.count) continue
        seenLayers.add(layer.title)

        out.push({
            layer,
            rowId: view.rowIds[i],
            lng: view.positions[i * 2],
            lat: view.positions[i * 2 + 1],
        })
    }
    return out
}

/**
 * The picked rows' attributes, shaped for the popup pipeline — one query per
 * layer. A failed lookup still yields its feature rather than dropping the click.
 */
export async function hydrateParquetPointHits(hits: ParquetPointHit[]): Promise<WfsLayerFeature[]> {
    const byLayer = new Map<string, ParquetPointHit[]>()
    for (const hit of hits) {
        const list = byLayer.get(hit.layer.title)
        if (list) list.push(hit)
        else byLayer.set(hit.layer.title, [hit])
    }

    const out: WfsLayerFeature[] = []
    await Promise.all([...byLayer.values()].map(async (group) => {
        const attrTable = group[0].layer.deckData?.attrTable
        let props = new Map<number, Record<string, unknown>>()
        if (attrTable) {
            try {
                props = await queryParquetRowProperties(attrTable, group.map(h => h.rowId))
            } catch (e) {
                console.warn(`[user-layers] attribute lookup failed for "${group[0].layer.title}":`, e)
            }
        }
        for (const hit of group) {
            out.push({
                id: `parquet-${hit.layer.title}-${hit.rowId}`,
                layerTitle: hit.layer.title,
                properties: props.get(hit.rowId) ?? {},
                geometry: { type: 'Point', coordinates: [hit.lng, hit.lat] },
            })
        }
    }))
    return out
}

interface DeckGlOverlayProps {
    map: maplibregl.Map | null
    layers: ParquetLayerProps[]
    /** Populated with the live overlay so the map-click pipeline can pick against it. */
    overlayRef?: React.MutableRefObject<MapboxOverlay | null>
}

function hexToRgb(hex: string, alpha = 255): [number, number, number, number] {
    const cleaned = hex.replace('#', '')
    if (cleaned.length === 6) {
        return [
            parseInt(cleaned.slice(0, 2), 16),
            parseInt(cleaned.slice(2, 4), 16),
            parseInt(cleaned.slice(4, 6), 16),
            Math.round(alpha),
        ]
    }
    return [37, 99, 235, Math.round(alpha)]
}

export function DeckGlOverlay({ map, layers, overlayRef }: DeckGlOverlayProps) {
    const localRef = useRef<MapboxOverlay | null>(null)
    // The route's viewport params. They are rewritten on `moveend`, which makes
    // them the signal to re-read the slice — no move listener of our own.
    const { zoom, lat, lon } = useSearch({ strict: false })

    const pointLayers = useMemo(
        () => layers.filter(l => l.visible !== false && l.deckData?.kind === 'points' && !!l.deckData.pointTable),
        [layers],
    )

    // Padded so a small pan stays covered by the slice already drawn.
    const bbox = useMemo<[number, number, number, number] | null>(() => {
        void zoom; void lat; void lon
        if (!map) return null
        const b = map.getBounds()
        const padX = (b.getEast() - b.getWest()) * VIEWPORT_PAD
        const padY = (b.getNorth() - b.getSouth()) * VIEWPORT_PAD
        return [b.getWest() - padX, b.getSouth() - padY, b.getEast() + padX, b.getNorth() + padY]
    }, [map, zoom, lat, lon])

    // Deck's per-frame cost scales with instances drawn, so the GPU gets this
    // slice rather than the whole table. `keepPreviousData` stops a pan blanking
    // the layer while the next slice is read.
    const views = useQueries({
        queries: pointLayers.map(layer => ({
            queryKey: ['parquet-viewport', layer.deckData?.pointTable, bbox] as const,
            queryFn: () => queryPointsInViewport(layer.deckData?.pointTable ?? '', bbox ?? [0, 0, 0, 0]),
            enabled: !!bbox && !!layer.deckData?.pointTable,
            placeholderData: keepPreviousData,
            staleTime: Infinity,
        })),
    })

    const deckLayers = useMemo(() => {
        const viewByTitle = new Map<string, ParquetPointView>()
        pointLayers.forEach((layer, i) => {
            const view = views[i]?.data
            if (view) viewByTitle.set(layer.title, view)
        })

        return layers
            .filter(l => l.visible !== false && l.deckData)
            .map((layer): DeckLayer | null => {
                const data = layer.deckData!
                const color = layer.color || '#2563eb'
                const opacity = layer.opacity ?? 0.85

                if (data.kind === 'points') {
                    const view = viewByTitle.get(layer.title)
                    if (!view || view.count === 0) return null
                    return new ScatterplotLayer({
                        id: getDeckLayerId(layer),
                        data: {
                            length: view.count,
                            attributes: {
                                getPosition: { value: view.positions, size: 2 },
                            },
                        },
                        [POINT_VIEW_PROP]: view,
                        radiusUnits: 'pixels',
                        getRadius: 3,
                        getFillColor: hexToRgb(color, opacity * 255),
                        pickable: true,
                        autoHighlight: false,
                        _validate: false,
                    })
                }

                return null
            })
            .filter((l): l is DeckLayer => l != null)
    }, [layers, pointLayers, views])

    useEffect(() => {
        if (!map) return
        const overlay = new MapboxOverlay({ interleaved: false, layers: [] })
        map.addControl(overlay)
        localRef.current = overlay
        if (overlayRef) overlayRef.current = overlay

        return () => {
            try {
                map.removeControl(overlay)
            } catch {
                // Ignore if map instance is already destroyed
            }
            localRef.current = null
            if (overlayRef) overlayRef.current = null
        }
    }, [map, overlayRef])

    useEffect(() => {
        localRef.current?.setProps({ layers: deckLayers })
    }, [deckLayers])

    return null
}
