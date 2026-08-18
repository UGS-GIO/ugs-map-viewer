/**
 * Regression guard for ALL-4953 — "zoom to" silently did nothing on the
 * "Geologic Units (500k)" layer in the layer list.
 *
 * The layer-extent lookup (src/hooks/use-layer-extent.ts) fetches WMS
 * GetCapabilities from a layer's `url` and searches it for that layer's
 * *workspace-qualified* sublayer name (e.g. `mapping:mapping_geolunits_500k`).
 * GeoServer only lists layers under their qualified names in the GLOBAL `/wms`
 * capabilities document; a workspace-scoped virtual service such as
 * `/mapping/wms` lists them UNqualified (`mapping_geolunits_500k`). So when a
 * config points at `/mapping/wms`, the qualified name is never found, the
 * extent resolves to null, and `map.fitBounds` is never called — zoom-to
 * no-ops with no error surfaced.
 *
 * Invariant (checked across EVERY map route's config, not just the ones that
 * carried the bug): a WMS layer served by our GeoServer must
 *   1. use the global `/wms` endpoint, never a workspace-scoped `/{ws}/wms`, and
 *   2. carry workspace-qualified sublayer names — the qualified name is what the
 *      global GetCapabilities lists, so an unqualified name would break the same
 *      lookup even on the correct endpoint.
 *
 * Route configs are discovered dynamically, so a newly added route (or a fresh
 * `/mapping/wms` slip in an existing one) is covered automatically.
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
