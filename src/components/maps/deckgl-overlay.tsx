import { useEffect, useRef, useMemo } from 'react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type maplibregl from 'maplibre-gl'
import type { ParquetLayerProps } from '@/lib/types/mapping-types'
import type { WfsLayerFeature } from '@/hooks/use-wfs-layer-data'
import { getArrowRowProperties } from '@/lib/map/user-layers/parquet-deck-loader'

export function queryParquetLayersAtPoint(
    map: maplibregl.Map,
    point: { x: number; y: number },
    tolerance: number,
    layers: ParquetLayerProps[],
): WfsLayerFeature[] {
    if (layers.length === 0) return []
    const out: WfsLayerFeature[] = []

    for (const layer of layers) {
        if (!layer.deckData) continue
        const title = layer.title

        if (layer.deckData.kind === 'points' && layer.deckData.points) {
            const { positions, count } = layer.deckData.points
            const sw = map.unproject([point.x - tolerance, point.y + tolerance])
            const ne = map.unproject([point.x + tolerance, point.y - tolerance])
            const minLng = Math.min(sw.lng, ne.lng)
            const maxLng = Math.max(sw.lng, ne.lng)
            const minLat = Math.min(sw.lat, ne.lat)
            const maxLat = Math.max(sw.lat, ne.lat)

            const clickLng = (sw.lng + ne.lng) / 2
            const clickLat = (sw.lat + ne.lat) / 2
            let bestDistSq = Infinity
            let bestIdx = -1

            for (let i = 0; i < count; i++) {
                const lng = positions[i * 2]
                const lat = positions[i * 2 + 1]
                if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
                    const dlng = lng - clickLng
                    const dlat = lat - clickLat
                    const dsq = dlng * dlng + dlat * dlat
                    if (dsq < bestDistSq) {
                        bestDistSq = dsq
                        bestIdx = i
                    }
                }
            }

            if (bestIdx >= 0) {
                const lng = positions[bestIdx * 2]
                const lat = positions[bestIdx * 2 + 1]
                const props = layer.deckData.table
                    ? getArrowRowProperties(layer.deckData.table, bestIdx)
                    : (layer.deckData.properties?.[bestIdx] ?? { index: bestIdx, longitude: lng, latitude: lat })
                out.push({
                    id: `parquet-${title}-${bestIdx}`,
                    layerTitle: title,
                    properties: props,
                    geometry: { type: 'Point', coordinates: [lng, lat] },
                })
            }
        }

        if (layer.deckData.kind === 'geojson' && layer.deckData.geojson) {
            for (let i = 0; i < layer.deckData.geojson.features.length; i++) {
                const f = layer.deckData.geojson.features[i]
                if (!f.geometry) continue
                out.push({
                    id: (f.id as string | number | undefined) ?? `parquet-${title}-${i}`,
                    layerTitle: title,
                    properties: (f.properties as Record<string, unknown>) ?? {},
                    geometry: f.geometry,
                })
                break
            }
        }
    }
    return out
}

interface DeckGlOverlayProps {
    map: maplibregl.Map | null
    layers: ParquetLayerProps[]
    onFeatureClick?: (feature: {
        layerTitle: string
        properties: Record<string, unknown>
        geometry?: GeoJSON.Geometry
        coordinate?: [number, number]
    }) => void
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

export function DeckGlOverlay({ map, layers, onFeatureClick }: DeckGlOverlayProps) {
    const overlayRef = useRef<MapboxOverlay | null>(null)

    const deckLayers = useMemo(() => {
        return layers
            .filter(l => l.visible !== false && l.deckData)
            .map(layer => {
                const data = layer.deckData!
                const color = layer.color || '#2563eb'
                const opacity = layer.opacity ?? 0.85

                if (data.kind === 'points' && data.points) {
                    const count = data.points.count
                    return new ScatterplotLayer({
                        id: `deck-parquet-points-${layer.title}`,
                        data: {
                            length: count,
                            attributes: {
                                getPosition: { value: data.points.positions, size: 2 },
                            },
                        },
                        radiusUnits: 'pixels',
                        getRadius: 3,
                        getFillColor: hexToRgb(color, opacity * 255),
                        pickable: true,
                        autoHighlight: false,
                        _validate: false,
                        onClick: (info: PickingInfo) => {
                            if (info.index >= 0) {
                                const props = data.table
                                    ? getArrowRowProperties(data.table, info.index)
                                    : (data.properties?.[info.index] ?? { index: info.index })
                                const coord = info.coordinate ? [info.coordinate[0], info.coordinate[1]] as [number, number] : undefined
                                onFeatureClick?.({
                                    layerTitle: layer.title,
                                    properties: props,
                                    coordinate: coord,
                                })
                            }
                        },
                    })
                }

                if (data.kind === 'geojson' && data.geojson) {
                    return new GeoJsonLayer({
                        id: `deck-parquet-geojson-${layer.title}`,
                        data: data.geojson,
                        filled: true,
                        stroked: true,
                        getFillColor: hexToRgb(color, opacity * 255 * 0.4),
                        getLineColor: hexToRgb(color, opacity * 255),
                        getLineWidth: 2,
                        lineWidthUnits: 'pixels',
                        getPointRadius: 5,
                        pointRadiusUnits: 'pixels',
                        pickable: true,
                        onClick: (info: PickingInfo) => {
                            const obj = info.object as { properties?: Record<string, unknown>; geometry?: GeoJSON.Geometry } | undefined
                            if (obj) {
                                const coord = info.coordinate ? [info.coordinate[0], info.coordinate[1]] as [number, number] : undefined
                                onFeatureClick?.({
                                    layerTitle: layer.title,
                                    properties: obj.properties ?? {},
                                    geometry: obj.geometry,
                                    coordinate: coord,
                                })
                            }
                        },
                    })
                }

                return null
            })
            .filter((l): l is NonNullable<typeof l> => l != null)
    }, [layers, onFeatureClick])

    useEffect(() => {
        if (!map) return
        const overlay = new MapboxOverlay({
            interleaved: false,
            layers: deckLayers,
        })
        map.addControl(overlay)
        overlayRef.current = overlay

        return () => {
            try {
                map.removeControl(overlay)
            } catch {
                // Ignore if map instance is already destroyed
            }
            overlayRef.current = null
        }
    }, [map])

    useEffect(() => {
        if (overlayRef.current) {
            overlayRef.current.setProps({ layers: deckLayers })
        }
    }, [deckLayers])

    return null
}
