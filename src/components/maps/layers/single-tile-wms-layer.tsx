import { useEffect, useState } from 'react'
import { Source, Layer, useMap } from 'react-map-gl/maplibre'
import type { WMSLayerProps } from '@/lib/types/mapping-types'
import { getWmsLayerName } from '@/lib/map/layer-utils'

interface SingleTileWmsLayerProps {
  layer: WMSLayerProps
  wmsUrl: string
  cqlFilter?: string
}

/** Convert longitude to EPSG:3857 easting */
function lngToMercX(lng: number): number {
  return lng * 20037508.342789244 / 180
}

/** Convert latitude to EPSG:3857 northing */
function latToMercY(lat: number): number {
  const rad = lat * Math.PI / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 20037508.342789244 / Math.PI
}

/**
 * Renders a WMS layer as a single image covering the viewport.
 * Eliminates tile seams by requesting one GetMap image instead of 256/512px tiles.
 * Requests in EPSG:3857 to avoid projection distortion from 4326→3857 warping.
 */
export function SingleTileWmsLayer({ layer, wmsUrl, cqlFilter }: SingleTileWmsLayerProps) {
  const { current: map } = useMap()
  const [, setMoveCount] = useState(0)

  // Single effect: force re-render on map move
  useEffect(() => {
    if (!map) return
    const gl = map.getMap()
    const onMove = () => setMoveCount(c => c + 1)
    gl.on('moveend', onMove)
    return () => { gl.off('moveend', onMove) }
  }, [map])

  if (!map) return null

  const gl = map.getMap()
  const bounds = gl.getBounds()
  const canvas = gl.getCanvas()
  const layerName = getWmsLayerName(layer)
  const layerWmsUrl = layer.url || wmsUrl

  const west = bounds.getWest()
  const south = bounds.getSouth()
  const east = bounds.getEast()
  const north = bounds.getNorth()

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    layers: layerName,
    styles: '',
    srs: 'EPSG:3857',
    bbox: `${lngToMercX(west)},${latToMercY(south)},${lngToMercX(east)},${latToMercY(north)}`,
    width: String(Math.min(canvas.width, 2048)),
    height: String(Math.min(canvas.height, 2048)),
    format: 'image/png',
    transparent: 'true',
  })
  if (cqlFilter) {
    params.set('CQL_FILTER', cqlFilter)
  }

  const imageUrl = `${layerWmsUrl}?${params.toString()}`

  return (
    <Source
      key={imageUrl}
      id={`wms-single-${layer.title}`}
      type="image"
      url={imageUrl}
      coordinates={[
        [west, north],
        [east, north],
        [east, south],
        [west, south],
      ]}
    >
      <Layer
        id={`wms-single-layer-${layer.title}`}
        type="raster"
        paint={{ 'raster-opacity': layer.opacity ?? 0.8 }}
        metadata={{
          title: layer.title,
          'wms-url': layerWmsUrl,
          'wms-layer': layerName,
        }}
      />
    </Source>
  )
}
