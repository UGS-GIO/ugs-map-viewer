import type { IControl, MapMouseEvent, Map as MapLibreMap } from 'maplibre-gl'
import type { QueryClient } from '@tanstack/react-query'
import type { Feature } from 'geojson'
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  type GeoJSONStoreFeatures,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { registerMeasureControl, type MeasureMode, type Measurement, type UnitSystem } from './measure-store'
import { featureMeasurement, labelPoint, labelText, restorableFeatures } from './measure-features'
import { COLOR, HALO_LAYERS, HIT_LAYERS, LABELS, PREFIX, SHAPES, addMeasureLayers, haloFilter, layersToRaise, removeMeasureLayers, setLayerData } from './measure-layers'
import { PointElevations } from './point-elevations'
import { ProfileMarkers } from './profile-markers'

// Terra Draw's finish key; the phone Finish button sends it to the active mode
const FINISH_KEY = 'Enter'

const sameItems = <T>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i])

/** Distance, area and point measuring on its own Terra Draw, as a map control the toolbar and sidebar drive. */
export class MeasureControl implements IControl {
  measurements: Measurement[] = []
  private map?: MapLibreMap
  private draw?: TerraDraw
  private lineMode?: TerraDrawLineStringMode
  private polygonMode?: TerraDrawPolygonMode
  private syncing = false
  private units: UnitSystem = 'us'
  private elevations: PointElevations
  private cache = new Map<string | number, { key: string; m: Measurement | undefined; at?: [number, number] }>()
  private listeners = new Set<() => void>()
  private firstResultListeners = new Set<() => void>()
  /** The measurement hovered on the map or in the sidebar, haloed in both */
  highlightedId?: string | number
  private profileMarkers = new ProfileMarkers(() => this.map)
  // The tool to open with once Terra Draw starts (the URL can name one before the style loads)
  private mode: MeasureMode | undefined
  /** A line or polygon is part-drawn */
  drawing = false
  // Finished measurements last sent to the shapes source, to skip setData while one is drawn
  private shapesFor: Measurement[] = []

  constructor(queryClient: QueryClient) {
    this.elevations = new PointElevations(queryClient, (ids) => this.refresh(ids))
  }

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
    this.profileMarkers.set(owner, kind, at)
  }

  remove = (id: string | number) => {
    this.profileMarkers.dropLine(id)
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

  clear = () => {
    this.profileMarkers.clear()
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
    this.setHighlight(id)
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
      else layersToRaise(order).forEach((id) => map.moveLayer(id))
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
    addMeasureLayers(map, this.highlightedId, this.profileMarkers.data())
    // Fresh sources after a style change: resend everything
    this.shapesFor = []
    this.refresh()
    this.updateLabels()
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
    const changed = !sameItems(next, this.measurements)
    if (changed) this.measurements = next
    this.cache.forEach((_, id) => {
      if (!byId.has(id)) { this.cache.delete(id); this.elevations.delete(id) }
    })
    if (changed) this.updateLabels()
    this.updateShapes(byId)
    if (this.highlightedId !== undefined && !byId.has(this.highlightedId)) this.setHighlight(undefined)
    const drawing = snapshot.some((f) => f.properties.currentlyDrawing === true)
    const drawingChanged = drawing !== this.drawing
    this.drawing = drawing
    if (changed || drawingChanged) this.listeners.forEach((l) => l())
  }

  // The value at each shape, for when the panel is closed; hovering links it to its row
  private updateLabels() {
    setLayerData(this.map, LABELS, this.measurements.flatMap((m): Feature[] => {
      const at = this.cache.get(m.id)?.at
      return at ? [{ type: 'Feature', properties: { label: labelText(m, this.units) }, geometry: { type: 'Point', coordinates: at } }] : []
    }))
  }

  // Finished shapes for hover and halo; unchanged while another shape is being drawn
  private updateShapes(byId: Map<string | number, GeoJSONStoreFeatures>) {
    const ms = this.measurements.filter((m) => !byId.get(m.id)?.properties.currentlyDrawing)
    if (sameItems(ms, this.shapesFor)) return
    this.shapesFor = ms
    setLayerData(this.map, SHAPES, ms.flatMap((m): Feature[] => {
      const f = byId.get(m.id)
      return f ? [{ type: 'Feature', properties: { mid: m.id }, geometry: f.geometry }] : []
    }))
  }

  // Reused while a feature is unchanged, so finished rows, profiles and label positions aren't redone
  private cached(f: GeoJSONStoreFeatures, changed?: Set<string | number>) {
    const id = f.id
    if (id === undefined) return undefined
    const hit = this.cache.get(id)
    // Unchanged per Terra Draw: skip stringifying its geometry (this runs on every pointer move)
    if (hit && changed && !changed.has(id)) return hit.m
    const g = f.geometry
    // A new point's lookup starts here, so its key below already reads as pending
    if (g.type === 'Point' && f.properties.mode === 'point') this.elevations.request(id, [g.coordinates[0], g.coordinates[1]])
    const key = `${JSON.stringify(g)}|${f.properties.currentlyDrawing}|${this.elevations.get(id)}`
    if (hit?.key === key) return hit.m
    const m = featureMeasurement(f, this.elevations.get(id))
    this.cache.set(id, { key, m, at: m && labelPoint(f) })
    return m
  }
}
