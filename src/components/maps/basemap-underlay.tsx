import { useEffect } from 'react'
import { useControl } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
import { DEM_SOURCE, HILLSHADE, SKY, TERRAIN } from './terrain-layers'

/**
 * The data map's style while blending: white, which multiplies to no change. Not transparent: a
 * see-through 3D surface shows the terrain tiles' skirts, which draw the data as vertical walls.
 */
export const BLEND_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

// White multiplies to no change, so the data map's sky and fog leave the basemap's showing.
export const BLEND_SKY: maplibregl.SkySpecification = { ...SKY, 'sky-color': '#ffffff', 'horizon-color': '#ffffff', 'fog-color': '#ffffff' }

const underlays = new WeakMap<maplibregl.Map, maplibregl.Map>()

/** The basemap map under `map` while blending, for export to composite. */
export function getBasemapUnderlay(map: maplibregl.Map): maplibregl.Map | undefined {
  return underlays.get(map)
}

/** The basemap with the hillshade under its labels and the same terrain as the data map, so 3D views line up. */
export function underlayStyle(style: StyleSpecification, terrain: boolean): StyleSpecification {
  if (!terrain) return style
  const labelIndex = style.layers.findIndex((l) => l.type === 'symbol')
  const layers = [...style.layers]
  layers.splice(labelIndex < 0 ? layers.length : labelIndex, 0, HILLSHADE)
  return {
    ...style,
    sources: { ...style.sources, [TERRAIN.source]: DEM_SOURCE, [HILLSHADE.source]: DEM_SOURCE },
    layers,
    terrain: TERRAIN,
    sky: SKY,
  }
}

function cameraOf(map: maplibregl.Map) {
  return {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    roll: map.getRoll(),
    elevation: map.getCenterElevation(),
  }
}

/**
 * Draws the basemap on its own map behind the data map's canvas, which multiplies over it like the
 * geology portal's ArcGIS `blendMode: "multiply"`. MapLibre has no per-layer blend mode, so the two
 * maps are composited by CSS instead.
 */
class BasemapUnderlayControl implements maplibregl.IControl {
  private main?: maplibregl.Map
  private underlay?: maplibregl.Map
  private container?: HTMLDivElement
  private lastCamera = ''

  // On render, not move: terrain changes the center's elevation without a move event.
  private readonly sync = () => {
    if (!this.main || !this.underlay) return
    const camera = cameraOf(this.main)
    const key = JSON.stringify(camera)
    if (key === this.lastCamera) return
    this.lastCamera = key
    this.underlay.jumpTo(camera)
    // Synchronous, so both canvases show the same frame; a queued repaint lags a frame behind on pans
    this.underlay.redraw()
  }

  onAdd(map: maplibregl.Map) {
    this.main = map
    this.container = document.createElement('div')
    this.container.style.cssText = 'position:absolute;inset:0;pointer-events:none'
    // First child, so the data map's canvas paints above it
    map.getContainer().prepend(this.container)
    this.underlay = new maplibregl.Map({
      container: this.container,
      ...cameraOf(map),
      // Take the data map's elevation as given rather than re-deriving it from half-loaded DEM tiles
      centerClampedToGround: false,
      maxPitch: map.getMaxPitch(),
      interactive: false,
      attributionControl: false,
      refreshExpiredTiles: false,
    })
    underlays.set(map, this.underlay)
    map.getCanvas().style.mixBlendMode = 'multiply'
    map.on('render', this.sync)
    return document.createElement('div')
  }

  onRemove(map: maplibregl.Map) {
    map.off('render', this.sync)
    map.getCanvas().style.mixBlendMode = ''
    underlays.delete(map)
    this.underlay?.remove()
    this.container?.remove()
    this.main = this.underlay = this.container = undefined
  }

  setBasemap(style: string | StyleSpecification, terrain: boolean) {
    this.underlay?.setStyle(style, { transformStyle: (_, next) => underlayStyle(next, terrain) })
  }
}

export function BasemapUnderlay({ style, terrain }: { style: string | StyleSpecification; terrain: boolean }) {
  const control = useControl(() => new BasemapUnderlayControl())
  useEffect(() => control.setBasemap(style, terrain), [control, style, terrain])
  return null
}
