import { Layer } from 'react-map-gl/maplibre'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import { HIGHLIGHT_STYLES, HOVER_HIGHLIGHT_STYLES, RESULT_HIGHLIGHT_STYLES } from '../constants'
import { useHoveredFeature } from '@/lib/map/hovered-feature'
import { getPmtilesSourceId } from '@/components/maps/pmtiles-layer-source'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'
import type { HighlightFeature } from '../types'

type TileKey = { by: 'id' | 'ogc_fid'; value: string | number }

/**
 * How to find a PMTiles result again in its tiles. The click query ids a feature by its tile id,
 * falling back to ogc_fid; with neither it can't be found, and keeps the GeoJSON highlight.
 */
export function pmtilesTileKey(f: HighlightFeature): TileKey | null {
  const fid = f.properties?.ogc_fid
  if ((typeof fid === 'number' || typeof fid === 'string') && fid === f.id) return { by: 'ogc_fid', value: fid }
  if (f.id == null || f.id === '' || f.id === 0) return null
  return { by: 'id', value: f.id }
}

const NOTHING: FilterSpecification = ['boolean', false]

function matchFilter(features: HighlightFeature[]): ExpressionSpecification | null {
  const keys = features.map(pmtilesTileKey).filter((k): k is TileKey => k !== null)
  if (keys.length === 0) return null
  const ids = keys.filter((k) => k.by === 'id').map((k) => k.value)
  const fids = keys.filter((k) => k.by === 'ogc_fid').map((k) => k.value)

  const expressions: ExpressionSpecification[] = []
  if (ids.length > 0) expressions.push(['in', ['id'], ['literal', ids]])
  if (fids.length > 0) expressions.push(['in', ['get', 'ogc_fid'], ['literal', fids]])

  if (expressions.length === 0) return null
  if (expressions.length === 1) return expressions[0]
  return ['any', ...expressions]
}

const ofType = (types: string[], match: ExpressionSpecification | null): FilterSpecification =>
  match ? ['all', ['match', ['geometry-type'], types, true, false], match] : NOTHING
const POLYGON = ['Polygon', 'MultiPolygon']
const LINE = ['LineString', 'MultiLineString']
const POINT = ['Point', 'MultiPoint']

/**
 * The results, selection and hover of one PMTiles layer, drawn from its own vector source so a
 * feature highlights whole across tile edges. Layers keep a fixed order (results, selection,
 * hover) because they all mount together and only their filters change.
 */
export function PmtilesHighlightLayers({ layer, results, active }: {
  layer: PMTilesLayerProps
  /** Already gated on the whole selection having more than one result */
  results: HighlightFeature[]
  active: HighlightFeature[]
}) {
  const hovered = useHoveredFeature()
  const hover = hovered?.layerTitle === layer.title ? [hovered] : []
  if (results.length === 0 && active.length === 0 && hover.length === 0) return null

  const source = getPmtilesSourceId(layer)
  const sourceLayer = layer.sourceLayer
  const id = (name: string) => `${source}-highlight-${name}`
  const r = matchFilter(results)
  const a = matchFilter(active)
  const h = matchFilter(hover)

  return (
    <>
      <Layer id={id('result-line')} type="line" source={source} source-layer={sourceLayer} filter={ofType(LINE, r)} paint={RESULT_HIGHLIGHT_STYLES.line} />
      <Layer id={id('result-stroke')} type="line" source={source} source-layer={sourceLayer} filter={ofType(POLYGON, r)} paint={RESULT_HIGHLIGHT_STYLES.stroke} />
      <Layer id={id('result-point')} type="circle" source={source} source-layer={sourceLayer} filter={ofType(POINT, r)} paint={RESULT_HIGHLIGHT_STYLES.circle} />

      <Layer id={id('line-shadow')} type="line" source={source} source-layer={sourceLayer} filter={ofType(LINE, a)} paint={HIGHLIGHT_STYLES.line.shadow} />
      <Layer id={id('line')} type="line" source={source} source-layer={sourceLayer} filter={ofType(LINE, a)} paint={HIGHLIGHT_STYLES.line.main} />
      <Layer id={id('fill')} type="fill" source={source} source-layer={sourceLayer} filter={ofType(POLYGON, a)} paint={HIGHLIGHT_STYLES.fill.main} />
      <Layer id={id('fill-stroke')} type="line" source={source} source-layer={sourceLayer} filter={ofType(POLYGON, a)} paint={HIGHLIGHT_STYLES.fill.stroke} />
      <Layer id={id('point-shadow')} type="circle" source={source} source-layer={sourceLayer} filter={ofType(POINT, a)} paint={HIGHLIGHT_STYLES.circle.shadow} />
      <Layer id={id('point')} type="circle" source={source} source-layer={sourceLayer} filter={ofType(POINT, a)} paint={HIGHLIGHT_STYLES.circle.main} />

      <Layer id={id('hover-fill')} type="fill" source={source} source-layer={sourceLayer} filter={ofType(POLYGON, h)} paint={HOVER_HIGHLIGHT_STYLES.fill} />
      <Layer id={id('hover-stroke')} type="line" source={source} source-layer={sourceLayer} filter={ofType(POLYGON, h)} paint={HOVER_HIGHLIGHT_STYLES.stroke} />
      <Layer id={id('hover-line')} type="line" source={source} source-layer={sourceLayer} filter={ofType(LINE, h)} paint={HOVER_HIGHLIGHT_STYLES.line} />
      <Layer id={id('hover-point')} type="circle" source={source} source-layer={sourceLayer} filter={ofType(POINT, h)} paint={HOVER_HIGHLIGHT_STYLES.circle} />
    </>
  )
}
