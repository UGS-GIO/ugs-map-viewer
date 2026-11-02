import type { GeoJSONSource, IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { QueryClient } from '@tanstack/react-query'
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
import { formatArea, formatLength, isMeasureMode, metersToFeet, registerMeasureControl, type MeasureMode, type Measurement } from './measure-store'

const PREFIX = 'measure-td'
const LABELS = `${PREFIX}-labels`
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

  constructor(private queryClient: QueryClient) {}

  onAdd(map: MapLibreMap) {
    this.map = map
    map.on('styledata', this.sync)
    registerMeasureControl(map, this)
    this.sync()
    const container = document.createElement('div')
    container.hidden = true
    return container
  }

  onRemove() {
    if (this.map) {
      this.map.off('styledata', this.sync)
      registerMeasureControl(this.map, undefined)
    }
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
    // Numbered to match the sidebar's "Distance 1", "Area 2"; values live there
    const labels: Feature<Point>[] = this.measurements.flatMap((m, i) => {
      const f = snapshot.find((s) => s.id === m.id)
      const at = f && labelPoint(f)
      return at ? [{ type: 'Feature', properties: { label: String(i + 1) }, geometry: { type: 'Point', coordinates: at } }] : []
    })
    this.map?.getSource<GeoJSONSource>(LABELS)?.setData({ type: 'FeatureCollection', features: labels })
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
