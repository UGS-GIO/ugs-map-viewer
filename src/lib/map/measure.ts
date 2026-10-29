import type { GeoJSONSource, IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  type GeoJSONStoreFeatures,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { area } from '@turf/area'
import { length } from '@turf/length'
import polylabel from 'polylabel'
import { elevationAt } from './dem-elevation'
import {
  MEASURE_MODES,
  formatArea,
  formatLength,
  metersToFeet,
  type MeasureMode,
  type Measurement,
} from './measure-store'

const PREFIX = 'measure-td'
const LABELS = `${PREFIX}-labels`
const COLOR = '#2563eb'

function isMeasureMode(value: unknown): value is MeasureMode {
  return MEASURE_MODES.some((m) => m === value)
}

const labelText = (m: Measurement) =>
  m.mode === 'point'
    ? m.elevationFt === undefined ? '' : `${Math.round(m.elevationFt).toLocaleString()} ft`
    : `${m.value?.toLocaleString()} ${m.unit}`

function labelPoint(f: GeoJSONStoreFeatures): [number, number] | undefined {
  const g = f.geometry
  if (g.type === 'Point') return [g.coordinates[0], g.coordinates[1]]
  if (g.type === 'LineString') {
    const last = g.coordinates[g.coordinates.length - 1]
    return [last[0], last[1]]
  }
  if (g.type === 'Polygon') {
    const [x, y] = polylabel(g.coordinates.map((ring) => ring.map(([lng, lat]): [number, number] => [lng, lat])), 0.0001)
    return [x, y]
  }
  return undefined
}

/**
 * Distance, area and point-elevation measuring on its own Terra Draw instance, labelled on the map.
 * A map control so react-map-gl adds and removes it; the map tools and sidebar drive it.
 */
export class MeasureControl implements IControl {
  measurements: Measurement[] = []
  private map?: MapLibreMap
  private draw?: TerraDraw
  private elevationsFt = new Map<string | number, number | 'pending'>()
  private listeners = new Set<() => void>()

  onAdd(map: MapLibreMap) {
    this.map = map
    this.start()
    map.on('style.load', this.restart)
    const container = document.createElement('div')
    container.hidden = true
    return container
  }

  onRemove() {
    this.map?.off('style.load', this.restart)
    this.stopDraw()
    if (this.map?.getLayer(LABELS)) this.map.removeLayer(LABELS)
    if (this.map?.getSource(LABELS)) this.map.removeSource(LABELS)
    this.map = undefined
  }

  setMode(mode: MeasureMode | undefined) {
    if (this.draw?.enabled) this.draw.setMode(mode ?? 'static')
  }

  clear() {
    this.draw?.clear()
    this.elevationsFt.clear()
    this.refresh()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private start(features: GeoJSONStoreFeatures[] = [], mode = 'static') {
    const map = this.map
    if (!map) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: PREFIX }),
      modes: [
        new TerraDrawLineStringMode({ styles: { lineStringColor: COLOR, lineStringWidth: 3, closingPointColor: COLOR } }),
        new TerraDrawPolygonMode({
          styles: { fillColor: COLOR, fillOpacity: 0.15, outlineColor: COLOR, outlineWidth: 2, closingPointColor: COLOR },
        }),
        new TerraDrawPointMode({ styles: { pointColor: COLOR, pointWidth: 6, pointOutlineColor: '#ffffff', pointOutlineWidth: 2 } }),
      ],
    })
    draw.start()
    if (features.length) draw.addFeatures(features)
    draw.setMode(mode)
    draw.on('change', this.refresh)
    this.draw = draw
    map.addSource(LABELS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: LABELS,
      type: 'symbol',
      source: LABELS,
      layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-offset': [0, -1.2], 'text-allow-overlap': true },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    })
    this.refresh()
  }

  private stopDraw() {
    // stop() throws removing layers a new style already dropped
    try { this.draw?.stop() } catch { /* already gone */ }
    this.draw = undefined
  }

  // A basemap switch drops our layers; start over with the same drawings
  private restart = () => {
    const features = this.draw?.getSnapshot() ?? []
    const mode = this.draw?.getMode()
    this.stopDraw()
    this.start(features, mode)
  }

  private refresh = () => {
    const snapshot = this.draw?.getSnapshot() ?? []
    this.measurements = snapshot.flatMap((f) => this.measure(f) ?? [])
    const labels: Feature<Point>[] = this.measurements.flatMap((m) => {
      const f = snapshot.find((s) => s.id === m.id)
      const at = f && labelPoint(f)
      return at ? [{ type: 'Feature', properties: { label: labelText(m) }, geometry: { type: 'Point', coordinates: at } }] : []
    })
    this.map?.getSource<GeoJSONSource>(LABELS)?.setData({ type: 'FeatureCollection', features: labels })
    this.listeners.forEach((l) => l())
  }

  private measure(f: GeoJSONStoreFeatures): Measurement | undefined {
    const mode = f.properties.mode
    const id = f.id
    if (!isMeasureMode(mode) || id === undefined) return undefined
    const g = f.geometry
    if (g.type === 'LineString') return { id, mode, ...formatLength(length(f, { units: 'meters' })) }
    if (g.type === 'Polygon') return { id, mode, ...formatArea(area(f)) }
    if (g.type !== 'Point') return undefined
    const [lng, lat] = g.coordinates
    if (!this.elevationsFt.has(id)) {
      this.elevationsFt.set(id, 'pending')
      elevationAt(lng, lat)
        .then((m) => { this.elevationsFt.set(id, metersToFeet(m)); this.refresh() })
        .catch(() => this.elevationsFt.delete(id))
    }
    const ft = this.elevationsFt.get(id)
    return { id, mode, coordinates: [lng, lat], elevationFt: typeof ft === 'number' ? ft : undefined }
  }
}
