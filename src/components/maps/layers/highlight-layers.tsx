import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import { HIGHLIGHT_STYLES, HOVER_HIGHLIGHT_STYLES } from '../constants'
import { useHoveredFeature } from '@/lib/map/hovered-feature'
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
      // Spread: MapLibre 6 can't send null-prototype objects (from PMTiles features) to its worker
      properties: { ...f.properties },
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
        <Layer id="highlight-line-shadow" type="line" source="highlight-source" filter={['==', '$type', 'LineString']} paint={HIGHLIGHT_STYLES.line.shadow} />
      )}
      {hasLines && (
        <Layer id="highlight-line-main" type="line" source="highlight-source" filter={['==', '$type', 'LineString']} paint={HIGHLIGHT_STYLES.line.main} />
      )}
      {hasPolygons && (
        <Layer id="highlight-fill" type="fill" source="highlight-source" filter={['==', '$type', 'Polygon']} paint={HIGHLIGHT_STYLES.fill.main} />
      )}
      {hasPolygons && (
        <Layer id="highlight-fill-stroke" type="line" source="highlight-source" filter={['==', '$type', 'Polygon']} paint={HIGHLIGHT_STYLES.fill.stroke} />
      )}
      {hasPoints && (
        <Layer id="highlight-point-shadow" type="circle" source="highlight-source" filter={['==', '$type', 'Point']} paint={HIGHLIGHT_STYLES.circle.shadow} />
      )}
      {hasPoints && (
        <Layer id="highlight-point-main" type="circle" source="highlight-source" filter={['==', '$type', 'Point']} paint={HIGHLIGHT_STYLES.circle.main} />
      )}
    </Source>
  )
}

/** The result card under the pointer, drawn over the selection */
export function HoverHighlightLayer() {
  const hovered = useHoveredFeature()
  const data: FeatureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: hovered
      ? [{ type: 'Feature', id: hovered.id, geometry: hovered.geometry, properties: {} }]
      : [],
  }), [hovered])

  return (
    <Source id="hover-highlight-source" type="geojson" data={data}>
      <Layer id="hover-highlight-fill" type="fill" filter={['==', '$type', 'Polygon']} paint={HOVER_HIGHLIGHT_STYLES.fill} />
      <Layer id="hover-highlight-fill-stroke" type="line" filter={['==', '$type', 'Polygon']} paint={HOVER_HIGHLIGHT_STYLES.stroke} />
      <Layer id="hover-highlight-line" type="line" filter={['==', '$type', 'LineString']} paint={HOVER_HIGHLIGHT_STYLES.line} />
      <Layer id="hover-highlight-point" type="circle" filter={['==', '$type', 'Point']} paint={HOVER_HIGHLIGHT_STYLES.circle} />
    </Source>
  )
}
