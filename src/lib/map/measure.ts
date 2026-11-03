import type { GeoJSONSource, IControl, MapMouseEvent, Map as MapLibreMap } from 'maplibre-gl'
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
import { bbox } from '@turf/bbox'
import { elevationsAt } from './dem-elevation'
import { registerMeasureControl, type MeasureMode, type Measurement, type UnitSystem } from './measure-store'
import { featureMeasurement, labelPoint, labelText, layersToRaise, restorableFeatures, type ElevationState, type LoadedShape } from './measure-features'
import {
  COLOR,
  HALO_LAYERS,
  HIT_LAYERS,
  LABELS,
  PREFIX,
  PROFILE_CURSOR,
  SHAPES,
  addMeasureLayers,
  haloFilter,
  profileColor,
  removeMeasureLayers,
} from './measure-layers'

// Terra Draw's finish key; the phone Finish button sends it to the active mode
const FINISH_KEY = 'Enter'

/** Distance, area and point measuring on its own Terra Draw, as a map control the toolbar and sidebar drive. */
export class MeasureControl implements IControl {
  measurements: Measurement[] = []
  private map?: MapLibreMap
  private draw?: TerraDraw
  private lineMode?: TerraDrawLineStringMode
  private polygonMode?: TerraDrawPolygonMode
  private syncing = false
  private units: UnitSystem = 'us'
  private elevationsM = new Map<string | number, ElevationState>()
  private cache = new Map<string | number, { key: string; m: Measurement | undefined; at?: [number, number] }>()
  private listeners = new Set<() => void>()
  private firstResultListeners = new Set<() => void>()
  /** The measurement hovered on the map or in the sidebar, haloed in both */
  highlightedId?: string | number
  // Profile markers by line: each pinned point, plus where the pointer is on a chart
  private profilePoints = { pin: new Map<string | number, [number, number]>(), hover: new Map<string | number, [number, number]>() }
  // The tool to open with once Terra Draw starts (the URL can name one before the style loads)
  private mode: MeasureMode | undefined
  // Points still waiting on their DEM lookup, read together
  private pendingPoints = new Map<string | number, [number, number]>()
  /** A line or polygon is part-drawn */
  drawing = false
  // Finished measurements last sent to the shapes source, to skip setData while one is drawn
  private shapesFor: Measurement[] = []

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
    if (this.map) removeMeasureLayers(this.map)
    this.map = undefined
  }

  setMode(mode: MeasureMode | undefined) {
    this.mode = mode
    if (this.draw?.enabled) this.draw.setMode(mode ?? 'static')
  }

  setUnits(units: UnitSystem) {
    if (units === this.units) return
    this.units = units
    this.updateLabels()
  }

  /** Sets or clears a line's pinned or hovered profile marker on the map. */
  setProfilePoint = (owner: string | number, kind: 'pin' | 'hover', at: [number, number] | undefined) => {
    if (at) this.profilePoints[kind].set(owner, at)
    else this.profilePoints[kind].delete(owner)
    // Follow the theme (MapLibre skips an unchanged paint value)
    if (at && this.map?.getLayer(PROFILE_CURSOR)) this.map.setPaintProperty(PROFILE_CURSOR, 'circle-color', profileColor())
    this.map?.getSource<GeoJSONSource>(PROFILE_CURSOR)?.setData(this.profileCursorData())
  }

  private profileCursorData(): FeatureCollection {
    const at = [...this.profilePoints.pin.values(), ...this.profilePoints.hover.values()]
    return { type: 'FeatureCollection', features: at.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) }
  }

  remove = (id: string | number) => {
    this.setProfilePoint(id, 'pin', undefined)
    this.setProfilePoint(id, 'hover', undefined)
    if (this.highlightedId === id) this.setHighlight(undefined)
    this.draw?.removeFeatures([id])
    this.refresh()
  }

  /** Finishes the part-drawn line or polygon (the phone button); Terra Draw has no public finish. */
  finish = () => {
    const mode = this.draw?.getMode()
    const active = mode === 'linestring' ? this.lineMode : mode === 'polygon' ? this.polygonMode : undefined
    active?.onKeyUp({ key: FINISH_KEY, heldKeys: [], preventDefault: () => {} })
  }

  /** Adds loaded shapes and zooms to them; returns how many Terra Draw accepted (it rejects e.g. self-crossing). */
  load(shapes: LoadedShape[]): number {
    const draw = this.draw
    if (!draw || !shapes.length) return 0
    const results = draw.addFeatures(
      shapes.map((s) => ({ type: 'Feature', id: draw.getFeatureId(), geometry: s.geometry, properties: { mode: s.mode } })),
    )
    const added = shapes.filter((_, i) => results[i]?.valid)
    if (added.length) {
      const [minX, minY, maxX, maxY] = bbox({ type: 'GeometryCollection', geometries: added.map((s) => s.geometry) })
      this.map?.fitBounds([minX, minY, maxX, maxY], { padding: 60, maxZoom: 15 })
    }
    this.refresh()
    return added.length
  }

  clear() {
    this.profilePoints.pin.clear()
    this.profilePoints.hover.clear()
    this.map?.getSource<GeoJSONSource>(PROFILE_CURSOR)?.setData(this.profileCursorData())
    this.draw?.clear()
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
    this.listeners.forEach((l) => l())
  }

  private onHover = (e: MapMouseEvent) => {
    const map = this.map
    // Nothing to hit, or the pointer is drawing
    if (!map || this.drawing || (!this.measurements.length && this.highlightedId === undefined)) return
    const layers = HIT_LAYERS.filter((l) => map.getLayer(l))
    const mid: unknown = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0]?.properties.mid : undefined
    const id = typeof mid === 'string' || typeof mid === 'number' ? mid : undefined
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
      else layersToRaise(order, PREFIX).forEach((id) => map.moveLayer(id))
    } finally {
      this.syncing = false
    }
  }

  private start(features: GeoJSONStoreFeatures[] = [], mode: string = this.mode ?? 'static') {
    const map = this.map
    if (!map) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: PREFIX }),
      modes: [
        (this.lineMode = new TerraDrawLineStringMode({
          keyEvents: { cancel: 'Escape', finish: FINISH_KEY },
          styles: { lineStringColor: COLOR, lineStringWidth: 3, closingPointColor: COLOR },
        })),
        (this.polygonMode = new TerraDrawPolygonMode({
          keyEvents: { cancel: 'Escape', finish: FINISH_KEY },
          styles: { fillColor: COLOR, fillOpacity: 0.15, outlineColor: COLOR, outlineWidth: 2, closingPointColor: COLOR },
        })),
        new TerraDrawPointMode({ styles: { pointColor: COLOR, pointWidth: 6, pointOutlineColor: '#ffffff', pointOutlineWidth: 2 } }),
      ],
    })
    draw.start()
    if (features.length) draw.addFeatures(features)
    draw.setMode(mode)
    draw.on('change', (ids) => this.refresh(new Set(ids)))
    draw.on('finish', () => {
      this.refresh()
      if (this.measurements.length === 1) this.firstResultListeners.forEach((l) => l())
    })
    this.draw = draw
    addMeasureLayers(map, this.highlightedId, this.profileCursorData())
    // Fresh sources after a style change: resend everything
    this.shapesFor = []
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
    const features = restorableFeatures(this.draw?.getSnapshot() ?? [])
    const mode = this.draw?.getMode()
    this.stopDraw(true)
    this.start(features, mode)
  }

  // `touched` limits re-measuring to those features (Terra Draw names them on each change)
  private refresh = (touched?: Set<string | number>) => {
    const snapshot = this.draw?.getSnapshot() ?? []
    const byId = new Map(snapshot.flatMap((f) => (f.id === undefined ? [] : [[f.id, f] as const])))
    const next = snapshot.flatMap((f) => this.cached(f, touched) ?? [])
    const changed = next.length !== this.measurements.length || next.some((m, i) => m !== this.measurements[i])
    if (changed) this.measurements = next
    this.cache.forEach((_, id) => {
      if (!byId.has(id)) { this.cache.delete(id); this.elevationsM.delete(id) }
    })
    this.updateLabels()
    this.updateShapes(byId)
    if (this.highlightedId !== undefined && !byId.has(this.highlightedId)) this.setHighlight(undefined)
    const drawing = snapshot.some((f) => f.properties.currentlyDrawing === true)
    const drawingChanged = drawing !== this.drawing
    this.drawing = drawing
    if (changed || drawingChanged) this.listeners.forEach((l) => l())
  }

  // The value at each shape, for when the panel is closed; hovering links it to its row
  private updateLabels() {
    const labels: Feature<Point>[] = this.measurements.flatMap((m) => {
      const at = this.cache.get(m.id)?.at
      return at ? [{ type: 'Feature', properties: { label: labelText(m, this.units) }, geometry: { type: 'Point', coordinates: at } }] : []
    })
    this.map?.getSource<GeoJSONSource>(LABELS)?.setData({ type: 'FeatureCollection', features: labels })
  }

  // Finished shapes for hover and halo; unchanged while another shape is being drawn
  private updateShapes(byId: Map<string | number, GeoJSONStoreFeatures>) {
    const ms = this.measurements.filter((m) => !byId.get(m.id)?.properties.currentlyDrawing)
    if (ms.length === this.shapesFor.length && ms.every((m, i) => m === this.shapesFor[i])) return
    this.shapesFor = ms
    const shapes = ms.flatMap((m): Feature[] => {
      const f = byId.get(m.id)
      return f ? [{ type: 'Feature', properties: { mid: m.id }, geometry: f.geometry }] : []
    })
    this.map?.getSource<GeoJSONSource>(SHAPES)?.setData({ type: 'FeatureCollection', features: shapes })
  }

  // Reused while a feature is unchanged, so finished rows, profiles and label positions aren't redone
  private cached(f: GeoJSONStoreFeatures, changed?: Set<string | number>) {
    const id = f.id
    if (id === undefined) return undefined
    const hit = this.cache.get(id)
    // Unchanged per Terra Draw: skip stringifying its geometry (this runs on every pointer move)
    if (hit && changed && !changed.has(id)) return hit.m
    const geometry = JSON.stringify(f.geometry)
    const keyOf = () => `${geometry}|${f.properties.currentlyDrawing}|${this.elevationsM.get(id)}`
    if (hit?.key === keyOf()) return hit.m
    const m = this.measure(f, id)
    // Keyed after measuring: a new point's lookup is now pending
    this.cache.set(id, { key: keyOf(), m, at: m && labelPoint(f) })
    return m
  }

  private measure(f: GeoJSONStoreFeatures, id: string | number): Measurement | undefined {
    const g = f.geometry
    if (g.type === 'Point' && f.properties.mode === 'point' && !this.elevationsM.has(id)) {
      this.elevationsM.set(id, 'pending')
      if (!this.pendingPoints.size) queueMicrotask(this.lookUpPoints)
      this.pendingPoints.set(id, [g.coordinates[0], g.coordinates[1]])
    }
    return featureMeasurement(f, this.elevationsM.get(id))
  }

  // One DEM read and one refresh for every point added together (a loaded file can hold many)
  private lookUpPoints = () => {
    const batch = [...this.pendingPoints]
    this.pendingPoints.clear()
    elevationsAt(this.queryClient, batch.map(([, at]) => at))
      .then((es) => batch.forEach(([id], i) => this.elevationsM.set(id, es[i])))
      // Keep the failure so later draw changes don't refetch it
      .catch((err) => {
        console.warn('[measure] point elevation lookup failed:', err)
        batch.forEach(([id]) => this.elevationsM.set(id, 'failed'))
      })
      .finally(() => this.refresh(new Set(batch.map(([id]) => id))))
  }
}
