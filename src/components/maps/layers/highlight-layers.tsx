import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { HIGHLIGHT_STYLES } from '../constants'
import type { HighlightFeature } from '../types'

interface HighlightLayersProps {
  features: HighlightFeature[]
}

/**
 * Renders highlight layers for selected features
 * Handles points, lines, and polygons with shadow effects
 */
export function HighlightLayers({ features }: HighlightLayersProps) {
  // Convert to GeoJSON
  const geoJson: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: f.geometry,
      properties: f.properties || {},
    })),
  }), [features])

  // Detect geometry types
  const hasLines = useMemo(() =>
    features.some(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'),
    [features]
  )
  const hasPolygons = useMemo(() =>
    features.some(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
    [features]
  )
  const hasPoints = useMemo(() =>
    features.some(f => f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint'),
    [features]
  )

  if (features.length === 0) return null

  return (
    <Source id="highlight-source" type="geojson" data={geoJson}>
      {hasLines && (
        <Layer id="highlight-line-shadow" type="line" source="highlight-source" paint={HIGHLIGHT_STYLES.line.shadow} />
      )}
      {hasLines && (
        <Layer id="highlight-line-main" type="line" source="highlight-source" paint={HIGHLIGHT_STYLES.line.main} />
      )}
      {hasPolygons && (
        <Layer id="highlight-fill" type="fill" source="highlight-source" paint={HIGHLIGHT_STYLES.fill.main} />
      )}
      {hasPolygons && (
        <Layer id="highlight-fill-stroke" type="line" source="highlight-source" paint={HIGHLIGHT_STYLES.fill.stroke} />
      )}
      {hasPoints && (
        <Layer id="highlight-point-shadow" type="circle" source="highlight-source" paint={HIGHLIGHT_STYLES.circle.shadow} />
      )}
      {hasPoints && (
        <Layer id="highlight-point-main" type="circle" source="highlight-source" paint={HIGHLIGHT_STYLES.circle.main} />
      )}
    </Source>
  )
}
