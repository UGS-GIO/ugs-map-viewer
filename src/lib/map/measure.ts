import type { AddLayerObject, FilterSpecification, GeoJSONSource, IControl, MapMouseEvent, Map as MapLibreMap } from 'maplibre-gl'
import type { QueryClient } from '@tanstack/react-query'
import type { Feature, FeatureCollection, Point } from 'geojson'
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
import { formatArea, formatLength, isMeasureMode, metersToFeet, registerMeasureControl, type MeasureMode, type Measurement } from './measure-store'

const PREFIX = 'measure-td'
const LABELS = `${PREFIX}-labels`
// Finished shapes again, for hover hit-testing and the highlight halo
const SHAPES = `${PREFIX}-shapes`
const HIT_LAYERS = [`${SHAPES}-hit-line`, `${SHAPES}-hit-fill`, `${SHAPES}-hit-point`]
const HALO_LAYERS = [`${SHAPES}-halo-line`, `${SHAPES}-halo-point`]
// Where the pointer is on an elevation profile, placed along its line
const PROFILE_CURSOR = `${PREFIX}-profile-cursor`
// --chart-1 (dark), the profile's series color, so the marker reads as the chart's point
const PROFILE_COLOR = '#e37d49'
const emptyCollection = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] })
const COLOR = '#2563eb'

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

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function labelText(m: Measurement) {
  if (m.value !== undefined) return `${fmt(m.value)} ${m.unit}`
  return typeof m.elevationFt === 'number' ? `${fmt(Math.round(m.elevationFt))} ft` : ''
}

const haloFilter = (id: string | number | undefined): FilterSpecification => ['==', ['get', 'mid'], id ?? '']

/**
 * Distance, area and point-elevation measuring on its own Terra Draw instance, labelled on the map.
 * A map control so react-map-gl adds and removes it; the map tools and sidebar drive it.
 */
export class MeasureControl implements IControl {
  measurements: Measurement[] = []
  private map?: MapLibreMap
  private draw?: TerraDraw
  private syncing = false
  private elevationsFt = new Map<string | number, number | 'pending' | 'failed'>()
  // Reused while a feature is unchanged, so finished rows and their profiles don't re-render
  private cache = new Map<string | number, { key: string; m: Measurement | undefined }>()
  private listeners = new Set<() => void>()
  private firstResultListeners = new Set<() => void>()
  /** The measurement hovered on the map or in the sidebar, haloed in both */
  highlightedId?: string | number
  private profileCursor?: [number, number]
  private highlightListeners = new Set<() => void>()

  constructor(private queryClient: QueryClient) {}

  onAdd(map: MapLibreMap) {
    this.map = map
    map.on('styledata', this.sync)
    map.on('mousemove', this.onHover)
    registerMeasureControl(map, this)
    this.sync()
    const container = document.createElement('div')
    container.hidden = true
    return container
  }

  onRemove() {
    if (this.map) {
      this.map.off('styledata', this.sync)
      this.map.off('mousemove', this.onHover)
      registerMeasureControl(this.map, undefined)
    }
    this.stopDraw()
    ;[LABELS, ...HIT_LAYERS, ...HALO_LAYERS, PROFILE_CURSOR].forEach((id) => { if (this.map?.getLayer(id)) this.map.removeLayer(id) })
    ;[LABELS, SHAPES, PROFILE_CURSOR].forEach((id) => { if (this.map?.getSource(id)) this.map.removeSource(id) })
    this.map = undefined
  }

  setMode(mode: MeasureMode | undefined) {
    if (this.draw?.enabled) this.draw.setMode(mode ?? 'static')
  }

  setProfileCursor = (at: [number, number] | undefined) => {
    this.profileCursor = at
    this.map?.getSource<GeoJSONSource>(PROFILE_CURSOR)?.setData(this.profileCursorData())
  }

  private profileCursorData(): FeatureCollection {
    const at = this.profileCursor
    return at ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } }] } : emptyCollection()
  }

  clear() {
    this.setProfileCursor(undefined)
    this.draw?.clear()
    this.elevationsFt.clear()
    this.refresh()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setHighlight = (id: string | number | undefined) => {
    if (id === this.highlightedId) return
    this.highlightedId = id
    HALO_LAYERS.forEach((l) => { if (this.map?.getLayer(l)) this.map.setFilter(l, haloFilter(id)) })
    this.highlightListeners.forEach((l) => l())
  }

  subscribeHighlight = (listener: () => void) => {
    this.highlightListeners.add(listener)
    return () => { this.highlightListeners.delete(listener) }
  }

  private onHover = (e: MapMouseEvent) => {
    const map = this.map
    if (!map) return
    const layers = HIT_LAYERS.filter((l) => map.getLayer(l))
    const mid = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0]?.properties.mid : undefined
    const id = this.measurements.find((m) => m.id === mid)?.id
    if (id === this.highlightedId) return
    this.setHighlight(id)
    if (id !== undefined) document.querySelector(`[data-measure-id="${CSS.escape(String(id))}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  /** Fires when a measurement finishes and it's the only one on the map. */
  onFirstResult = (listener: () => void) => {
    this.firstResultListeners.add(listener)
    return () => { this.firstResultListeners.delete(listener) }
  }

  /**
   * Waits out the first style load, starts over when a basemap switch drops our layers (a diffed
   * setStyle doesn't fire style.load), and keeps our layers above data layers added later.
   */
  private sync = () => {
    const map = this.map
    if (!map || this.syncing) return
    const order = map.getLayersOrder()
    if (!order.length) return
    this.syncing = true
    try {
      if (!this.draw) this.start()
      else if (!map.getLayer(LABELS)) this.restart()
      else {
        const first = order.findIndex((id) => id.startsWith(PREFIX))
        if (first >= 0 && order.slice(first).some((id) => !id.startsWith(PREFIX))) {
          order.filter((id) => id.startsWith(PREFIX)).forEach((id) => map.moveLayer(id))
        }
      }
    } finally {
      this.syncing = false
    }
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
    draw.on('finish', () => {
      this.refresh()
      if (this.measurements.length === 1) this.firstResultListeners.forEach((l) => l())
    })
    this.draw = draw
    if (!map.getSource(LABELS)) map.addSource(LABELS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    if (!map.getLayer(LABELS)) map.addLayer({
      id: LABELS,
      type: 'symbol',
      source: LABELS,
      // Streets serves only Noto glyphs; raster basemaps have no glyphs URL and draw text locally
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-offset': [0, -1.2], 'text-allow-overlap': true },
      paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
    })
    if (!map.getSource(SHAPES)) map.addSource(SHAPES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    const notPoint: FilterSpecification = ['!=', ['geometry-type'], 'Point']
    const point: FilterSpecification = ['==', ['geometry-type'], 'Point']
    const layers: AddLayerObject[] = [
      { id: HALO_LAYERS[0], type: 'line', source: SHAPES, filter: haloFilter(this.highlightedId), paint: { 'line-color': COLOR, 'line-width': 10, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: HALO_LAYERS[1], type: 'circle', source: SHAPES, filter: haloFilter(this.highlightedId), paint: { 'circle-color': COLOR, 'circle-radius': 12, 'circle-opacity': 0.35 } },
      // Invisible but still hit by queryRenderedFeatures; wider than the marks so hovering is easy
      { id: HIT_LAYERS[0], type: 'line', source: SHAPES, filter: notPoint, paint: { 'line-width': 14, 'line-opacity': 0 } },
      { id: HIT_LAYERS[1], type: 'fill', source: SHAPES, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-opacity': 0 } },
      { id: HIT_LAYERS[2], type: 'circle', source: SHAPES, filter: point, paint: { 'circle-radius': 12, 'circle-opacity': 0 } },
    ]
    if (!map.getSource(PROFILE_CURSOR)) map.addSource(PROFILE_CURSOR, { type: 'geojson', data: this.profileCursorData() })
    layers.push({
      id: PROFILE_CURSOR,
      type: 'circle',
      source: PROFILE_CURSOR,
      paint: { 'circle-color': PROFILE_COLOR, 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    })
    layers.forEach((l) => { if (!map.getLayer(l.id)) map.addLayer(l) })
    this.refresh()
  }

  private stopDraw(layersGone = false) {
    try {
      this.draw?.stop()
    } catch (err) {
      // Expected when a basemap switch already dropped our layers; anything else is worth seeing
      if (!layersGone) console.warn('[measure] Terra Draw stop failed:', err)
    }
    this.draw = undefined
  }

  // Start over with the finished drawings; a half-drawn one and its helper points can't be re-added
  private restart() {
    const features = (this.draw?.getSnapshot() ?? []).filter((f) => {
      const mode = f.properties.mode
      return isMeasureMode(mode) && !f.properties.currentlyDrawing && (f.geometry.type !== 'Point' || mode === 'point')
    })
    const mode = this.draw?.getMode()
    this.stopDraw(true)
    this.start(features, mode)
  }

  private refresh = () => {
    const snapshot = this.draw?.getSnapshot() ?? []
    const next = snapshot.flatMap((f) => this.cached(f) ?? [])
    const changed = next.length !== this.measurements.length || next.some((m, i) => m !== this.measurements[i])
    if (changed) this.measurements = next
    this.cache.forEach((_, id) => { if (!snapshot.some((f) => f.id === id)) this.cache.delete(id) })
    // The value at each shape, for when the panel is closed; hovering links it to its row
    const labels: Feature<Point>[] = this.measurements.flatMap((m) => {
      const f = snapshot.find((s) => s.id === m.id)
      const at = f && labelPoint(f)
      return at ? [{ type: 'Feature', properties: { label: labelText(m) }, geometry: { type: 'Point', coordinates: at } }] : []
    })
    this.map?.getSource<GeoJSONSource>(LABELS)?.setData({ type: 'FeatureCollection', features: labels })
    const shapes: Feature[] = snapshot.flatMap((f) =>
      f.id !== undefined && !f.properties.currentlyDrawing && this.measurements.some((m) => m.id === f.id)
        ? [{ type: 'Feature', properties: { mid: f.id }, geometry: f.geometry }]
        : [],
    )
    this.map?.getSource<GeoJSONSource>(SHAPES)?.setData({ type: 'FeatureCollection', features: shapes })
    if (this.highlightedId !== undefined && !this.measurements.some((m) => m.id === this.highlightedId)) this.setHighlight(undefined)
    if (changed) this.listeners.forEach((l) => l())
  }

  private cached(f: GeoJSONStoreFeatures) {
    if (f.id === undefined) return undefined
    const key = `${JSON.stringify(f.geometry)}|${f.properties.currentlyDrawing}|${this.elevationsFt.get(f.id)}`
    const hit = this.cache.get(f.id)
    if (hit?.key === key) return hit.m
    const m = this.measure(f)
    this.cache.set(f.id, { key: `${JSON.stringify(f.geometry)}|${f.properties.currentlyDrawing}|${this.elevationsFt.get(f.id)}`, m })
    return m
  }

  private measure(f: GeoJSONStoreFeatures): Measurement | undefined {
    const mode = f.properties.mode
    const id = f.id
    if (!isMeasureMode(mode) || id === undefined) return undefined
    const g = f.geometry
    if (g.type === 'LineString') {
      const path = f.properties.currentlyDrawing ? undefined : g.coordinates.map(([x, y]): [number, number] => [x, y])
      return { id, mode, path, ...formatLength(length(f, { units: 'meters' })) }
    }
    if (g.type === 'Polygon') return { id, mode, ...formatArea(area(f)) }
    // Line and polygon modes add helper points (closing, snapping) while drawing
    if (g.type !== 'Point' || mode !== 'point') return undefined
    const [lng, lat] = g.coordinates
    if (!this.elevationsFt.has(id)) {
      this.elevationsFt.set(id, 'pending')
      elevationAt(this.queryClient, lng, lat)
        .then((m) => { this.elevationsFt.set(id, metersToFeet(m)); this.refresh() })
        // Keep the failure so later draw changes don't refetch it
        .catch((err) => {
          console.warn('[measure] point elevation lookup failed:', err)
          this.elevationsFt.set(id, 'failed')
          this.refresh()
        })
    }
    const ft = this.elevationsFt.get(id)
    return { id, mode, coordinates: [lng, lat], elevationFt: typeof ft === 'number' ? ft : ft === 'failed' ? null : undefined }
  }
}
