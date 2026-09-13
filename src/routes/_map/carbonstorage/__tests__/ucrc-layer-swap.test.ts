/**
 * ALL-4356 — Carbon Storage swaps its GeoServer WMS "Cores and Cuttings"
 * layer for the warehouse UCRC inventory (STAC-driven pmtiles, item
 * `enmin_ucrc_wells`). The display title stays "Cores and Cuttings" so the
 * existing `ccuslayerinfo` description row (already UCRC-accurate) keeps the
 * config↔DB consistency test green.
 *
 * These assertions read the actual carbonstorage config — no network.
 */
import { describe, it, expect } from 'vitest'
import type { LayerProps, GroupLayerProps, WMSLayerProps, PMTilesLayerProps } from '@/lib/types/mapping-types'
import layersConfig from '@/routes/_map/carbonstorage/-data/layers/layers'

function isGroupLayer(layer: LayerProps): layer is GroupLayerProps {
  return layer.type === 'group'
}

function flattenLeaves(layers: LayerProps[]): LayerProps[] {
  const out: LayerProps[] = []
  for (const layer of layers) {
    if (isGroupLayer(layer) && layer.layers) out.push(...flattenLeaves(layer.layers))
    else out.push(layer)
  }
  return out
}

describe('carbonstorage: UCRC inventory replaces Cores and Cuttings (ALL-4356)', () => {
  const leaves = flattenLeaves(layersConfig)

  it('no longer serves the GeoServer WMS cores layer', () => {
    const wmsCores = leaves.find(
      (l) => l.type === 'wms' && (l as WMSLayerProps).sublayers?.some((s) => s.name?.endsWith(':cores')),
    )
    expect(wmsCores).toBeUndefined()
  })

  it('serves the UCRC STAC/pmtiles inventory titled "Cores and Cuttings"', () => {
    const ucrc = leaves.find(
      (l) => l.type === 'pmtiles' && (l as PMTilesLayerProps).stacItemId === 'enmin_ucrc_wells',
    ) as PMTilesLayerProps | undefined
    expect(ucrc).toBeDefined()
    expect(ucrc?.title).toBe('Cores and Cuttings')
  })
})
