import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { PROFILE_CURSOR, profileColor } from './measure-layers'

type Id = string | number

/** Markers on the map for where each line's elevation profile is pinned or hovered. */
export class ProfileMarkers {
  private byLine = new Map<Id, { pin?: [number, number]; hover?: [number, number] }>()

  constructor(private getMap: () => MapLibreMap | undefined) {}

  set(line: Id, kind: 'pin' | 'hover', at: [number, number] | undefined) {
    const wasEmpty = !this.data().features.length
    const next = { ...this.byLine.get(line), [kind]: at }
    if (next.pin || next.hover) this.byLine.set(line, next)
    else this.byLine.delete(line)
    // Follow the theme; read once per appearance since getComputedStyle forces a style recalc
    const map = this.getMap()
    if (at && wasEmpty && map?.getLayer(PROFILE_CURSOR)) map.setPaintProperty(PROFILE_CURSOR, 'circle-color', profileColor())
    this.send()
  }

  dropLine(line: Id) {
    if (this.byLine.delete(line)) this.send()
  }

  clear() {
    this.byLine.clear()
    this.send()
  }

  data(): FeatureCollection {
    const at = [...this.byLine.values()].flatMap((m) => [m.pin, m.hover].filter((c) => c !== undefined))
    return { type: 'FeatureCollection', features: at.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) }
  }

  private send() {
    this.getMap()?.getSource<GeoJSONSource>(PROFILE_CURSOR)?.setData(this.data())
  }
}
