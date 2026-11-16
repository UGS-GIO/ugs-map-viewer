import type { AddLayerObject, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'

// Map sources and layers the measure control adds beside Terra Draw's own

export const PREFIX = 'measure-td'
export const COLOR = '#2563eb'
export const LABELS = `${PREFIX}-labels`
// Finished shapes again, for hover hit-testing and the highlight halo
export const SHAPES = `${PREFIX}-shapes`
export const HIT_LAYERS = [`${SHAPES}-hit-line`, `${SHAPES}-hit-fill`, `${SHAPES}-hit-point`]
export const HALO_LAYERS = [`${SHAPES}-halo-line`, `${SHAPES}-halo-point`]
// Where the pointer is on an elevation profile, placed along its line
export const PROFILE_CURSOR = `${PREFIX}-profile-cursor`

/**
 * The profile chart's series color, `--chart-1`, for the current theme. MapLibre can't read CSS
 * variables, so this resolves the `H S% L%` triplet the theme defines.
 */
export function profileColor() {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim()
  return hsl ? `hsl(${hsl.split(/\s+/).join(', ')})` : '#e37d49'
}

const emptyCollection = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })

export const haloFilter = (id: string | number | undefined): FilterSpecification => ['==', ['get', 'mid'], id ?? '']

const SOURCES = [LABELS, SHAPES, PROFILE_CURSOR]

/** Adds whatever of our sources and layers the current style lacks. */
export function addMeasureLayers(map: MapLibreMap, highlightedId: string | number | undefined, profileCursor: FeatureCollection) {
  SOURCES.forEach((id) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: id === PROFILE_CURSOR ? profileCursor : emptyCollection() })
  })
  const layers: AddLayerObject[] = [
    {
      id: LABELS,
      type: 'symbol',
      source: LABELS,
      // Streets serves only Noto glyphs; raster basemaps have no glyphs URL and draw text locally
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-offset': [0, -1.2], 'text-allow-overlap': true },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    },
    { id: HALO_LAYERS[0], type: 'line', source: SHAPES, filter: haloFilter(highlightedId), paint: { 'line-color': COLOR, 'line-width': 10, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
    { id: HALO_LAYERS[1], type: 'circle', source: SHAPES, filter: haloFilter(highlightedId), paint: { 'circle-color': COLOR, 'circle-radius': 12, 'circle-opacity': 0.35 } },
    // Invisible but still hit by queryRenderedFeatures; wider than the marks so hovering is easy
    { id: HIT_LAYERS[0], type: 'line', source: SHAPES, filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-width': 14, 'line-opacity': 0 } },
    { id: HIT_LAYERS[1], type: 'fill', source: SHAPES, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-opacity': 0 } },
    { id: HIT_LAYERS[2], type: 'circle', source: SHAPES, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 12, 'circle-opacity': 0 } },
    {
      id: PROFILE_CURSOR,
      type: 'circle',
      source: PROFILE_CURSOR,
      paint: { 'circle-color': profileColor(), 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    },
  ]
  layers.forEach((l) => { if (!map.getLayer(l.id)) map.addLayer(l) })
}

/** Our layer ids, in order, when any other layer sits above the lowest of them; else none. */
export function layersToRaise(order: string[]) {
  const first = order.findIndex((id) => id.startsWith(PREFIX))
  if (first < 0 || !order.slice(first).some((id) => !id.startsWith(PREFIX))) return []
  return order.filter((id) => id.startsWith(PREFIX))
}

export function setLayerData(map: MapLibreMap | undefined, source: typeof LABELS | typeof SHAPES, features: Feature[]) {
  map?.getSource<GeoJSONSource>(source)?.setData({ type: 'FeatureCollection', features })
}

export function removeMeasureLayers(map: MapLibreMap) {
  [LABELS, ...HALO_LAYERS, ...HIT_LAYERS, PROFILE_CURSOR].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id) })
  SOURCES.forEach((id) => { if (map.getSource(id)) map.removeSource(id) })
}
