import type { Map as MapLibreMap } from 'maplibre-gl'
import type { GeoJSONStoreFeatures } from 'terra-draw'
import { MaplibreMeasureControl, AWS_ELEVATION_TILES } from '@watergis/maplibre-gl-terradraw'

import { MEASURE_MODES, type MeasureMode, type Measurement } from './measure-store'

function isMeasureMode(value: unknown): value is MeasureMode {
  return MEASURE_MODES.some((m) => m === value)
}

function toMeasurement(f: GeoJSONStoreFeatures): Measurement | undefined {
  const p = f.properties
  if (!isMeasureMode(p.mode)) return undefined
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const point = f.geometry.type === 'Point' ? f.geometry.coordinates : undefined
  return {
    id: f.id ?? '',
    mode: p.mode,
    value: num(p.mode === 'polygon' ? p.area : p.distance),
    unit: str(p.mode === 'polygon' ? p.unit : p.distanceUnit),
    elevation: num(p.elevation),
    elevationUnit: str(p.elevationUnit),
    coordinates: point ? [point[0], point[1]] : undefined,
  }
}

/**
 * The library's measure control with its own buttons hidden: our map tools and sidebar panel drive it.
 * Keeps an immutable list of finished measurements for useSyncExternalStore.
 */
export class HeadlessMeasureControl extends MaplibreMeasureControl {
  measurements: Measurement[] = []
  private listeners = new Set<() => void>()

  constructor() {
    super({
      modes: [...MEASURE_MODES],
      measureUnitType: 'imperial',
      computeElevation: true,
      // Same DEM the 3D terrain uses
      terrainSource: AWS_ELEVATION_TILES,
    })
  }

  onAdd(map: MapLibreMap) {
    const container = super.onAdd(map)
    container.style.display = 'none'
    this.getTerraDrawInstance()?.on('change', this.refresh)
    map.on('style.load', this.restore)
    return container
  }

  onRemove() {
    this.map?.off('style.load', this.restore)
    super.onRemove()
  }

  setMeasureMode(mode: MeasureMode | undefined) {
    // Terra Draw throws on setMode before start
    if (mode) this.activate()
    const draw = this.getTerraDrawInstance()
    if (draw?.enabled) draw.setMode(mode ?? this.defaultMode)
  }

  clearAll() {
    this.handleDeleteAllFeatures()
    this.refresh()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // A basemap switch drops Terra Draw's layers; restart it and put the measurements back
  private restore = () => {
    const draw = this.getTerraDrawInstance()
    if (!draw?.enabled) return
    const mode = draw.getMode()
    const features = draw.getSnapshot()
    // stop() throws removing layers the new style already dropped, after it has marked itself stopped
    try { draw.stop() } catch { /* expected */ }
    draw.start()
    if (draw.getSnapshot().length === 0) draw.addFeatures(features)
    this.recalc()
    draw.setMode(mode)
  }

  private refresh = () => {
    const snapshot = this.getTerraDrawInstance()?.getSnapshot() ?? []
    this.measurements = snapshot.flatMap((f) => toMeasurement(f) ?? [])
    this.listeners.forEach((l) => l())
  }
}
