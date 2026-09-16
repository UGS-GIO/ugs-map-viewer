/**
 * Regression guard for ALL-4953: "zoom to" silently no-ops on a GeoServer WMS
 * layer whose config uses a workspace-scoped `/{ws}/wms`. The extent lookup
 * searches GetCapabilities for the qualified sublayer name
 * (`mapping:mapping_geolunits_500k`), which only the global `/wms` lists — a
 * workspace service lists it unqualified, so the extent resolves null.
 *
 * Invariant, checked across every map route's config: a GeoServer WMS layer
 * uses the global `/wms` endpoint and carries qualified (`ws:name`) sublayers.
 */
import { describe, it, expect } from 'vitest'
import { PROD_GEOSERVER_URL } from '@/lib/constants'
import { flattenWmsLayers } from '@/lib/map/layer-utils'
import type { LayerProps, WMSLayerProps } from '@/lib/types/mapping-types'

const GLOBAL_WMS = `${PROD_GEOSERVER_URL}/wms`

// Every layer-config module across the map routes, resolved at build time.
const configModules = import.meta.glob('../*/-data/layers/*.tsx', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const routeOf = (path: string) => path.match(/([^/]+)\/-data\//)?.[1] ?? path

const wmsCases: [route: string, title: string, layer: WMSLayerProps][] =
  Object.entries(configModules).flatMap(([path, config]) =>
    Array.isArray(config)
      ? flattenWmsLayers(config as LayerProps[]).map(
          (layer) =>
            [routeOf(path), layer.title, layer] as [
              string,
              string,
              WMSLayerProps,
            ]
        )
      : []
  )

// Only WMS layers served by our own GeoServer are subject to the invariant.
const geoserverCases = wmsCases.filter(
  ([, , layer]) => !!layer.url && layer.url.startsWith(PROD_GEOSERVER_URL)
)

describe('GeoServer WMS layers resolve extents via the global /wms endpoint (ALL-4953)', () => {
  it('discovers WMS layer configs across the map routes', () => {
    // Guards against a broken glob pattern silently turning this suite into a no-op.
    const routes = new Set(wmsCases.map(([route]) => route))
    expect(routes).toContain('subsurface')
    expect(routes).toContain('geophysics')
    expect(geoserverCases.length).toBeGreaterThan(0)
  })

  it.each(geoserverCases)(
    '%s / %s uses the global /wms endpoint',
    (_route, _title, layer) => {
      expect(layer.url).toBe(GLOBAL_WMS)
    }
  )

  it.each(geoserverCases)(
    '%s / %s carries workspace-qualified sublayer names',
    (_route, _title, layer) => {
      for (const sublayer of layer.sublayers ?? []) {
        if (sublayer.name) expect(sublayer.name).toContain(':')
      }
    }
  )
})
