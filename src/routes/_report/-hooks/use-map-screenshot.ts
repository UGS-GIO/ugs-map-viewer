import { useQuery } from '@tanstack/react-query'
import maplibregl from 'maplibre-gl'
import { queryKeys } from '@/lib/query-keys'
import { hazardLayerNameMap as importedHazardLayerNameMap } from '@/routes/_report/-data/hazard-unit-map'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { convertCoordinate, calculateBounds } from '@/lib/map/conversion-utils'

const hazardLayerNameMap: Record<string, string> = importedHazardLayerNameMap as Record<string, string>

interface MapScreenshotOptions {
    polygon?: string
    hazardCodes?: string[]
    height?: number
}

interface MapScreenshotResult {
    dataUrl: string
    scaleInfo: {
        text: string
        pixelWidth: number
    } | null
}

// Parse polygon coordinates to WGS84
function parsePolygonCoordinates(polygon: string | undefined): number[][] | null {
    if (!polygon) return null

    try {
        const parsed = JSON.parse(polygon)

        if (parsed.rings && Array.isArray(parsed.rings[0])) {
            const coords = parsed.rings[0]
            const sourceCRS = parsed.crs || 'EPSG:4326'

            if (sourceCRS !== 'EPSG:4326') {
                return coords.map(([x, y]: number[]) => {
                    return convertCoordinate([x, y], sourceCRS, 'EPSG:4326')
                })
            }

            return coords
        }

        if (Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') {
            return parsed
        }

        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
            return parsed.coordinates[0]
        }

        if (Array.isArray(parsed[0]?.[0]) && typeof parsed[0][0][0] === 'number') {
            return parsed[0]
        }

        if (parsed.geometry?.type === 'Polygon' && Array.isArray(parsed.geometry.coordinates?.[0])) {
            return parsed.geometry.coordinates[0]
        }

        console.warn('Unrecognized polygon format:', parsed)
        return null
    } catch (e) {
        console.error('Error parsing polygon:', e)
        return null
    }
}

function createPolygonFeature(coordinates: number[][]) {
    return {
        type: 'Feature' as const,
        geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates]
        },
        properties: {}
    }
}

function calculateScale(zoom: number, lat: number, canvasWidth: number, maxPixelWidth: number = 180) {
    const metersPerPixel = (40075016.686 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, zoom + 8)
    const targetPixels = Math.min(canvasWidth / 5, maxPixelWidth)
    let distanceInMeters = targetPixels * metersPerPixel

    let unit = 'm'
    if (distanceInMeters > 1000) {
        distanceInMeters /= 1000
        unit = 'km'
    }

    const niceNumbers = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
    let bestDistance = niceNumbers[0]
    for (let i = 0; i < niceNumbers.length; i++) {
        if (distanceInMeters / niceNumbers[i] >= 0.7) {
            bestDistance = niceNumbers[i]
        } else {
            break
        }
    }

    return { distance: bestDistance, unit }
}

async function captureMapScreenshot(
    polygon: string | undefined,
    hazardCodes: string[],
    width: number,
    height: number
): Promise<MapScreenshotResult> {
    const polygonCoords = parsePolygonCoordinates(polygon)
    const bounds = polygonCoords ? calculateBounds(polygonCoords) : null
    const polygonFeature = polygonCoords ? createPolygonFeature(polygonCoords) : null

    const validHazardLayers = hazardCodes
        .filter(code => hazardLayerNameMap[code])
        .map(code => ({
            code,
            layerName: hazardLayerNameMap[code]
        }))

    // Calculate initial view
    let center: [number, number] = [-111.8910, 40.7608]
    let zoom = 7

    if (bounds) {
        const [[minLng, minLat], [maxLng, maxLat]] = bounds
        center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2]

        const lngDiff = maxLng - minLng
        const latDiff = maxLat - minLat
        const maxDiff = Math.max(lngDiff, latDiff)

        if (maxDiff > 1) zoom = 7
        else if (maxDiff > 0.5) zoom = 8
        else if (maxDiff > 0.2) zoom = 9
        else if (maxDiff > 0.1) zoom = 10
        else if (maxDiff > 0.05) zoom = 11
        else if (maxDiff > 0.02) zoom = 12
        else zoom = 13
    }

    // Create off-screen container
    const container = document.createElement('div')
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    document.body.appendChild(container)

    return new Promise((resolve, reject) => {
        try {
            const map = new maplibregl.Map({
                container,
                style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
                center,
                zoom,
                // @ts-expect-error preserveDrawingBuffer is valid but not in types
                preserveDrawingBuffer: true,
                attributionControl: false,
                interactive: false
            })

            map.on('load', () => {
                if (bounds) {
                    map.fitBounds(bounds, { padding: 50, duration: 0 })
                }

                // Add hazard layers
                validHazardLayers.forEach(({ code, layerName }) => {
                    const wmsUrl = `${PROD_GEOSERVER_URL}/wms?` +
                        `SERVICE=WMS&VERSION=1.1.0&REQUEST=GetMap&FORMAT=image/png&` +
                        `TRANSPARENT=true&LAYERS=${layerName}&SRS=EPSG:3857&` +
                        `WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`

                    map.addSource(`hazard-${code}`, {
                        type: 'raster',
                        tiles: [wmsUrl],
                        tileSize: 256
                    })

                    map.addLayer({
                        id: `hazard-layer-${code}`,
                        type: 'raster',
                        source: `hazard-${code}`,
                        paint: { 'raster-opacity': 0.7 }
                    })
                })

                // Add polygon overlay
                if (polygonFeature) {
                    map.addSource('aoi-polygon', {
                        type: 'geojson',
                        data: polygonFeature
                    })

                    map.addLayer({
                        id: 'aoi-fill',
                        type: 'fill',
                        source: 'aoi-polygon',
                        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 }
                    })

                    map.addLayer({
                        id: 'aoi-outline',
                        type: 'line',
                        source: 'aoi-polygon',
                        paint: {
                            'line-color': '#3b82f6',
                            'line-width': 2.5,
                            'line-dasharray': [2, 2]
                        }
                    })
                }

                // Wait for tiles to load then capture
                const attemptCapture = () => {
                    if (map.loaded() && map.areTilesLoaded()) {
                        map.once('render', () => {
                            try {
                                const canvas = map.getCanvas()
                                const dataUrl = canvas.toDataURL('image/png', 1.0)

                                // Calculate scale info
                                const mapCenter = map.getCenter().toArray() as [number, number]
                                const mapZoom = map.getZoom()
                                const canvasWidth = canvas.width
                                const maxScaleWidth = Math.max(80, Math.min(canvasWidth * 0.4, 250))
                                const { distance, unit } = calculateScale(mapZoom, mapCenter[1], canvasWidth, maxScaleWidth)

                                const metersPerPixel = (40075016.686 * Math.cos(mapCenter[1] * Math.PI / 180)) / Math.pow(2, mapZoom + 8)
                                const distanceInMeters = unit === 'km' ? distance * 1000 : distance
                                const pixelWidth = Math.min(Math.round(distanceInMeters / metersPerPixel), maxScaleWidth)

                                // Cleanup
                                map.remove()
                                document.body.removeChild(container)

                                resolve({
                                    dataUrl,
                                    scaleInfo: {
                                        text: `${distance} ${unit}`,
                                        pixelWidth
                                    }
                                })
                            } catch (error) {
                                map.remove()
                                document.body.removeChild(container)
                                reject(error)
                            }
                        })
                        map.triggerRepaint()
                    } else {
                        setTimeout(attemptCapture, 200)
                    }
                }

                setTimeout(attemptCapture, 500)
            })

            map.on('error', (e) => {
                map.remove()
                document.body.removeChild(container)
                reject(e.error)
            })
        } catch (error) {
            document.body.removeChild(container)
            reject(error)
        }
    })
}

const DEFAULT_WIDTH = 800
const CACHE_TIME = 1000 * 60 * 30

/** Capture map screenshots with hazard layers. Cached via TanStack Query. */
export function useMapScreenshot({
    polygon,
    hazardCodes = [],
    height = 400
}: MapScreenshotOptions) {
    return useQuery({
        queryKey: queryKeys.map.screenshot(polygon || '', hazardCodes, DEFAULT_WIDTH, height),
        queryFn: () => captureMapScreenshot(polygon, hazardCodes, DEFAULT_WIDTH, height),
        enabled: !!polygon || hazardCodes.length > 0,
        staleTime: Infinity,
        gcTime: CACHE_TIME,
    })
}
