import { Source, Layer } from 'react-map-gl/maplibre'
import type { SpatialFilter, BoundsBox } from '../types'

interface SpatialFilterLayerProps {
  filter: SpatialFilter | undefined
}

/**
 * Renders the spatial filter polygon (from draw mode)
 */
export function SpatialFilterLayer({ filter }: SpatialFilterLayerProps) {
  if (!filter?.polygon) return null

  return (
    <Source
      id="spatial-filter-source"
      type="geojson"
      data={{ type: 'Feature', properties: {}, geometry: filter.polygon }}
    >
      <Layer
        id="spatial-filter-fill"
        type="fill"
        source="spatial-filter-source"
        paint={{ 'fill-color': '#f59e0b', 'fill-opacity': 0.15 }}
      />
      <Layer
        id="spatial-filter-outline"
        type="line"
        source="spatial-filter-source"
        paint={{ 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [4, 2] }}
      />
    </Source>
  )
}

interface ClickBufferLayerProps {
  bounds: BoundsBox
}

/**
 * Renders the click buffer visualization box
 */
export function ClickBufferLayer({ bounds }: ClickBufferLayerProps) {
  return (
    <Source
      id="click-buffer-source"
      type="geojson"
      data={{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bounds.sw[0], bounds.sw[1]],
            [bounds.ne[0], bounds.sw[1]],
            [bounds.ne[0], bounds.ne[1]],
            [bounds.sw[0], bounds.ne[1]],
            [bounds.sw[0], bounds.sw[1]],
          ]],
        },
      }}
    >
      <Layer
        id="click-buffer-fill"
        type="fill"
        source="click-buffer-source"
        paint={{ 'fill-color': '#00ff00', 'fill-opacity': 0.2 }}
      />
      <Layer
        id="click-buffer-outline"
        type="line"
        source="click-buffer-source"
        paint={{ 'line-color': '#00ff00', 'line-width': 2 }}
      />
    </Source>
  )
}
