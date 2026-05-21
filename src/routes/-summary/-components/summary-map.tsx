import { useEffect, useMemo, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import bbox from '@turf/bbox'
import type { Feature, FeatureCollection } from 'geojson'
import { DEFAULT_BASEMAP } from '@/lib/basemaps'
import type { LayerContentProps } from '@/components/maps/popups/types'
import type { LayerProps, WMSLayerProps } from '@/lib/types/mapping-types'
import { findLayerByTitle } from '@/lib/map/layer-utils'
import { useAllPagesLayerConfigs } from '@/hooks/use-get-layer-configs'
import 'maplibre-gl/dist/maplibre-gl.css'

// Orange ring overlaid on top of the WMS-rendered tiles so reviewers see
// which features were chosen. Real per-feature symbology comes from the WMS
// tile underneath (GeoServer applies the layer's SLD). When pmtiles selection
// lands, the tile source becomes a pmtile vector layer; everything else stays.
const SELECTION_COLOR = '#f97316'

interface WmsRasterAccess {
    layerTitle: string
    sourceId: string
    layerId: string
    tileUrl: string
}

function slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function resolveWmsRasterAccess(layerTitle: string, allLayers: LayerProps[]): WmsRasterAccess | null {
    const layer = findLayerByTitle(allLayers, layerTitle)
    if (!layer || (layer as { type?: string }).type !== 'wms') return null
    const wms = layer as WMSLayerProps
    if (!wms.url) return null
    const sublayerName = wms.sublayers?.[0]?.name
    if (!sublayerName) return null
    // Mirror the main app's WMS GetMap parameters (`factory/maplibre.ts`):
    // 512-px tiles + buffer keep symbols from clipping at tile edges, and
    // version 1.1.0 matches the SRS interpretation used elsewhere — without
    // these the rendered colors / symbol sizes drift from the source map.
    const params = new URLSearchParams({
        service: 'WMS',
        version: '1.1.0',
        request: 'GetMap',
        layers: sublayerName,
        styles: '',
        srs: 'EPSG:3857',
        width: '512',
        height: '512',
        format: 'image/png',
        transparent: 'true',
        buffer: '32',
    })
    if (wms.customLayerParameters) {
        for (const [k, v] of Object.entries(wms.customLayerParameters)) {
            if (v !== null && v !== undefined) params.set(k, String(v))
        }
    }
    const slugged = slug(layerTitle) || 'layer'
    const baseUrl = wms.url.replace(/\/$/, '')
    return {
        layerTitle,
        sourceId: `summary-wms-src-${slugged}`,
        layerId: `summary-wms-layer-${slugged}`,
        // MapLibre injects {bbox-epsg-3857} per tile request.
        tileUrl: `${baseUrl}?${params.toString()}&bbox={bbox-epsg-3857}`,
    }
}

interface SummaryMapProps {
    cards: LayerContentProps[]
    selectedLayerTitle?: string | null
    highlightedFeatureId?: string | number | null
    onMapReady?: (map: maplibregl.Map) => void
}

const SELECTION_SOURCE = 'summary-selection'
const FILL_LAYER = 'summary-selection-fill'
const LINE_LAYER = 'summary-selection-line'
const POINT_LAYER = 'summary-selection-point'

const lineWidth: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'highlighted'], false], 4, 1.5]
const lineOpacity: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'highlighted'], false], 1, 0.45]
const fillOpacity: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'highlighted'], false], 0.45, 0.18]
const circleRadius: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'highlighted'], false], 9, 5]
const circleOpacity: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'highlighted'], false], 1, 0.55]

export function SummaryMap({ cards, selectedLayerTitle, highlightedFeatureId, onMapReady }: SummaryMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const mapRef = useRef<maplibregl.Map | null>(null)
    const previousHighlightId = useRef<string | number | null>(null)
    // Track which WMS sources/layers we've added so we can tear them down
    // cleanly when the card set changes.
    const wmsLayerIdsRef = useRef<string[]>([])

    const { data: allLayers = [] } = useAllPagesLayerConfigs()

    const wmsAccesses = useMemo(() => {
        const out: Array<WmsRasterAccess & { autoVisible: boolean }> = []
        for (const card of cards) {
            const access = resolveWmsRasterAccess(card.layerTitle, allLayers)
            if (!access) continue
            // Auto-show WMS only for vector layers where the user actually
            // picked features. Raster cards (e.g. hazard rasters that
            // responded to the click point) stay hidden until the user
            // explicitly picks their pill — otherwise every queryable raster
            // floods the summary map.
            const autoVisible = card.sourceKind === 'vector' && card.features.length > 0
            out.push({ ...access, autoVisible })
        }
        return out
    }, [cards, allLayers])

    const featureCollection = useMemo<FeatureCollection>(() => {
        const features: Feature[] = []
        for (const card of cards) {
            for (const f of card.features) {
                if (!f.geometry) continue
                features.push({
                    type: 'Feature',
                    id: f.id,
                    geometry: f.geometry,
                    properties: { ...(f.properties ?? {}), _summaryLayer: card.layerTitle },
                })
            }
        }
        return { type: 'FeatureCollection', features }
    }, [cards])

    // Init map once.
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const basemapUrl = DEFAULT_BASEMAP.url
        const isRasterTiles = basemapUrl.includes('{z}') && basemapUrl.includes('{x}') && basemapUrl.includes('{y}')
        const style: maplibregl.StyleSpecification = isRasterTiles
            ? {
                version: 8,
                sources: { basemap: { type: 'raster', tiles: [basemapUrl], tileSize: 256, attribution: '' } },
                layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
            }
            : (basemapUrl as unknown as maplibregl.StyleSpecification)

        const map = new maplibregl.Map({
            container: containerRef.current,
            style,
            center: [-111.6, 39.5],
            zoom: 6,
            attributionControl: false,
        })
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        mapRef.current = map
        onMapReady?.(map)

        // Recover from WebGL context loss (HMR / multi-instance contention).
        const canvas = map.getCanvas()
        const onLost = (e: Event) => { e.preventDefault() }
        const onRestored = () => { mapRef.current?.triggerRepaint() }
        canvas.addEventListener('webglcontextlost', onLost, false)
        canvas.addEventListener('webglcontextrestored', onRestored, false)

        return () => {
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [onMapReady])

    // Combine geometry-type matching with optional per-layer filter into one
    // expression so toggling `selectedLayerTitle` is just `setFilter`, no
    // layer rebuild.
    const filterFor = useMemo(() => {
        return (geomTypes: string[]): maplibregl.FilterSpecification => {
            const geom: maplibregl.FilterSpecification = ['in', ['geometry-type'], ['literal', geomTypes]]
            return selectedLayerTitle
                ? (['all', geom, ['==', ['get', '_summaryLayer'], selectedLayerTitle]] as maplibregl.FilterSpecification)
                : geom
        }
    }, [selectedLayerTitle])

    // Push selection geometry + add layers on first call; refresh data + filters thereafter.
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const apply = () => {
            if (!map.getSource(SELECTION_SOURCE)) {
                map.addSource(SELECTION_SOURCE, { type: 'geojson', data: featureCollection })
                map.addLayer({
                    id: FILL_LAYER,
                    type: 'fill',
                    source: SELECTION_SOURCE,
                    filter: filterFor(['Polygon', 'MultiPolygon']),
                    paint: { 'fill-color': SELECTION_COLOR, 'fill-opacity': fillOpacity },
                })
                map.addLayer({
                    id: LINE_LAYER,
                    type: 'line',
                    source: SELECTION_SOURCE,
                    filter: filterFor(['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']),
                    paint: { 'line-color': SELECTION_COLOR, 'line-width': lineWidth, 'line-opacity': lineOpacity },
                })
                map.addLayer({
                    id: POINT_LAYER,
                    type: 'circle',
                    source: SELECTION_SOURCE,
                    filter: filterFor(['Point', 'MultiPoint']),
                    paint: {
                        'circle-radius': circleRadius,
                        'circle-color': SELECTION_COLOR,
                        'circle-stroke-color': SELECTION_COLOR,
                        'circle-stroke-width': 1,
                        'circle-opacity': circleOpacity,
                    },
                })
            } else {
                ;(map.getSource(SELECTION_SOURCE) as maplibregl.GeoJSONSource).setData(featureCollection)
                map.setFilter(FILL_LAYER, filterFor(['Polygon', 'MultiPolygon']))
                map.setFilter(LINE_LAYER, filterFor(['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']))
                map.setFilter(POINT_LAYER, filterFor(['Point', 'MultiPoint']))
            }

            if (featureCollection.features.length > 0) {
                try {
                    const [minX, minY, maxX, maxY] = bbox(featureCollection)
                    const ok = [minX, minY, maxX, maxY].every(Number.isFinite)
                        && minX >= -180 && maxX <= 180 && minY >= -90 && maxY <= 90
                        && minX <= maxX && minY <= maxY
                    if (ok) map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 48, maxZoom: 14, animate: false })
                } catch (err) {
                    console.warn('summary map: fitBounds failed', err)
                }
            }
        }

        if (map.isStyleLoaded()) apply()
        else map.once('load', apply)
    }, [featureCollection, filterFor])

    // Sync WMS raster layers (true symbology via GeoServer-rendered tiles).
    // Layers go BELOW the selection ring so the orange overlay still reads
    // as "you picked these" on top of the actual map rendering.
    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        const apply = () => {
            // Tear down previous WMS layers/sources.
            for (const id of wmsLayerIdsRef.current) {
                if (map.getLayer(id)) map.removeLayer(id)
                const srcId = id.replace(/^summary-wms-layer-/, 'summary-wms-src-')
                if (map.getSource(srcId)) map.removeSource(srcId)
            }
            wmsLayerIdsRef.current = []

            // Insert new ones BEFORE the orange overlay so they sit under it.
            const beforeId = map.getLayer(FILL_LAYER) ? FILL_LAYER : undefined
            for (const access of wmsAccesses) {
                if (map.getSource(access.sourceId)) continue
                map.addSource(access.sourceId, {
                    type: 'raster',
                    tiles: [access.tileUrl],
                    tileSize: 512,
                    scheme: 'xyz',
                })
                // Visibility: pill always wins (specific layer pick =
                // single-layer view). Otherwise auto-show for vector picks,
                // hide raster cards by default.
                const visible = selectedLayerTitle
                    ? selectedLayerTitle === access.layerTitle
                    : access.autoVisible
                map.addLayer({
                    id: access.layerId,
                    type: 'raster',
                    source: access.sourceId,
                    layout: { visibility: visible ? 'visible' : 'none' },
                }, beforeId)
                wmsLayerIdsRef.current.push(access.layerId)
            }
        }

        if (map.isStyleLoaded()) apply()
        else map.once('load', apply)
    }, [wmsAccesses, selectedLayerTitle])

    // Spotlight via feature-state. Clear previous, apply new.
    useEffect(() => {
        const map = mapRef.current
        if (!map) return
        const apply = () => {
            if (!map.getSource(SELECTION_SOURCE)) return
            const prev = previousHighlightId.current
            if (prev !== null && prev !== highlightedFeatureId) {
                map.removeFeatureState({ source: SELECTION_SOURCE, id: prev })
            }
            if (highlightedFeatureId !== null && highlightedFeatureId !== undefined) {
                map.setFeatureState({ source: SELECTION_SOURCE, id: highlightedFeatureId }, { highlighted: true })
            }
            previousHighlightId.current = highlightedFeatureId ?? null
        }
        if (map.isStyleLoaded()) apply()
        else map.once('load', apply)
    }, [highlightedFeatureId, featureCollection])

    // MapLibre overwrites `position` to `relative` at init, collapsing
    // `absolute inset-0`. Use flow sizing instead.
    return <div ref={containerRef} className="h-full w-full" />
}
