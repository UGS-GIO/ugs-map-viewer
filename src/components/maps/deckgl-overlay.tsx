import { useEffect, useRef, useMemo } from 'react'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type maplibregl from 'maplibre-gl'
import type { ParquetLayerProps } from '@/lib/types/mapping-types'

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
                    return new ScatterplotLayer({
                        id: `deck-parquet-points-${layer.title}`,
                        data: {
                            length: data.points.count,
                            attributes: {
                                getPosition: { value: data.points.positions, size: 2 },
                            },
                        },
                        radiusMinPixels: 2,
                        radiusMaxPixels: 20,
                        radiusScale: 1,
                        getRadius: 15,
                        getFillColor: hexToRgb(color, opacity * 255),
                        pickable: true,
                        onClick: (info: PickingInfo) => {
                            if (info.index >= 0) {
                                const props = data.properties?.[info.index] ?? {}
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
