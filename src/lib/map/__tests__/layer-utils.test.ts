import { describe, it, expect } from 'vitest'
import {
  isWMSLayer,
  isWFSLayer,
  isPMTilesLayer,
  isGroupLayer,
  isArcGISMapServerLayer,
  flattenVisibleLayers,
  flattenWmsLayers,
  flattenWfsLayers,
  flattenArcGisLayers,
} from '../layer-utils'
import type {
  LayerProps,
  WMSLayerProps,
  WFSLayerProps,
  PMTilesLayerProps,
  GroupLayerProps,
  ArcGISMapServerLayerProps,
} from '@/lib/types/mapping-types'

// ── Fixtures ─────────────────────────────────────────────────────────

const wmsLayer: WMSLayerProps = {
  type: 'wms',
  title: 'WMS Layer',
  url: 'https://example.com/wms',
  visible: true,
  sublayers: [{ name: 'ws:layer' }],
}

const wfsLayer: WFSLayerProps = {
  type: 'wfs',
  title: 'WFS Layer',
  wfsUrl: 'https://example.com/wfs',
  typeName: 'ws:layer',
  visible: true,
}

const pmtilesLayer: PMTilesLayerProps = {
  type: 'pmtiles',
  title: 'PMTiles Layer',
  pmtilesUrl: '/tiles/data.pmtiles',
  sourceLayer: 'data',
  visible: true,
}

const arcgisLayer: ArcGISMapServerLayerProps = {
  type: 'map-image',
  title: 'ArcGIS Layer',
  url: 'https://example.com/MapServer',
  visible: true,
}

const hiddenWms: WMSLayerProps = { ...wmsLayer, title: 'Hidden WMS', visible: false }
const hiddenArcgis: ArcGISMapServerLayerProps = { ...arcgisLayer, title: 'Hidden ArcGIS', visible: false }

const group: GroupLayerProps = {
  type: 'group',
  title: 'Group',
  layers: [wmsLayer, hiddenWms, wfsLayer, arcgisLayer],
}

// ── Type guards ──────────────────────────────────────────────────────

describe('type guards', () => {
  const layers: LayerProps[] = [wmsLayer, wfsLayer, pmtilesLayer, arcgisLayer, group]

  it.each([
    ['isWMSLayer', isWMSLayer, 'WMS Layer'],
    ['isWFSLayer', isWFSLayer, 'WFS Layer'],
    ['isPMTilesLayer', isPMTilesLayer, 'PMTiles Layer'],
    ['isArcGISMapServerLayer', isArcGISMapServerLayer, 'ArcGIS Layer'],
    ['isGroupLayer', isGroupLayer, 'Group'],
  ])('%s matches only its own type', (_name, guard, expectedTitle) => {
    const matches = layers.filter(guard)
    expect(matches).toHaveLength(1)
    expect(matches[0].title).toBe(expectedTitle)
  })
})

// ── flattenVisibleLayers ─────────────────────────────────────────────

describe('flattenVisibleLayers', () => {
  it('returns empty array for empty input', () => {
    expect(flattenVisibleLayers([], isWMSLayer)).toEqual([])
  })

  it('returns only visible layers matching the guard', () => {
    const layers: LayerProps[] = [wmsLayer, hiddenWms, wfsLayer, arcgisLayer]
    const result = flattenVisibleLayers(layers, isWMSLayer)
    expect(result).toEqual([wmsLayer])
  })

  it('recurses into groups', () => {
    const nested: GroupLayerProps = {
      type: 'group',
      title: 'Outer',
      layers: [group, hiddenArcgis, arcgisLayer],
    }
    const result = flattenVisibleLayers([nested], isArcGISMapServerLayer)
    expect(result).toHaveLength(2)
    expect(result.map(l => l.title)).toEqual(['ArcGIS Layer', 'ArcGIS Layer'])
  })

  it('skips hidden layers inside groups', () => {
    const result = flattenVisibleLayers([group], isWMSLayer)
    expect(result).toEqual([wmsLayer])
  })
})

// ── Convenience wrappers ─────────────────────────────────────────────

describe('convenience flatten wrappers', () => {
  const layers: LayerProps[] = [group, pmtilesLayer, hiddenArcgis]

  it('flattenWmsLayers returns only visible WMS', () => {
    expect(flattenWmsLayers(layers).map(l => l.title)).toEqual(['WMS Layer'])
  })

  it('flattenWfsLayers returns only visible WFS', () => {
    expect(flattenWfsLayers(layers).map(l => l.title)).toEqual(['WFS Layer'])
  })

  it('flattenArcGisLayers returns only visible ArcGIS', () => {
    expect(flattenArcGisLayers(layers).map(l => l.title)).toEqual(['ArcGIS Layer'])
  })
})
