import { describe, it, expect } from 'vitest'
import {
  isWMSLayer,
  isWFSLayer,
  isPMTilesLayer,
  isGroupLayer,
  isArcGISMapServerLayer,
  isCOGLayer,
  flattenLeaves,
  flattenWmsLayers,
  flattenWfsLayers,
  flattenArcGisLayers,
  flattenDataLayers,
  flattenDataLayersWithParent,
  resolveLeafVisibility,
} from '../layer-utils'
import type {
  LayerProps,
  WMSLayerProps,
  WFSLayerProps,
  PMTilesLayerProps,
  GroupLayerProps,
  ArcGISMapServerLayerProps,
  COGLayerProps,
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

const cogLayer: COGLayerProps = {
  type: 'cog',
  title: 'COG Layer',
  cogUrl: 'https://example.com/raster.tif',
  colorStops: ['#000', '#fff'],
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
  const layers: LayerProps[] = [wmsLayer, wfsLayer, pmtilesLayer, arcgisLayer, cogLayer, group]

  it.each([
    ['isWMSLayer', isWMSLayer, 'WMS Layer'],
    ['isWFSLayer', isWFSLayer, 'WFS Layer'],
    ['isPMTilesLayer', isPMTilesLayer, 'PMTiles Layer'],
    ['isArcGISMapServerLayer', isArcGISMapServerLayer, 'ArcGIS Layer'],
    ['isCOGLayer', isCOGLayer, 'COG Layer'],
    ['isGroupLayer', isGroupLayer, 'Group'],
  ])('%s matches only its own type', (_name, guard, expectedTitle) => {
    const matches = layers.filter(guard)
    expect(matches).toHaveLength(1)
    expect(matches[0].title).toBe(expectedTitle)
  })
})

// ── flattenLeaves ────────────────────────────────────────────────────

describe('flattenLeaves', () => {
  it('returns empty array for empty input', () => {
    expect(flattenLeaves([], isWMSLayer)).toEqual([])
  })

  it('returns all leaves matching the guard regardless of `visible`', () => {
    const layers: LayerProps[] = [wmsLayer, hiddenWms, wfsLayer, arcgisLayer]
    const result = flattenLeaves(layers, isWMSLayer)
    expect(result.map(l => l.title)).toEqual(['WMS Layer', 'Hidden WMS'])
  })

  it('recurses into groups', () => {
    const nested: GroupLayerProps = {
      type: 'group',
      title: 'Outer',
      layers: [group, hiddenArcgis, arcgisLayer],
    }
    const result = flattenLeaves([nested], isArcGISMapServerLayer)
    expect(result).toHaveLength(3)
    expect(result.map(l => l.title)).toEqual(['ArcGIS Layer', 'Hidden ArcGIS', 'ArcGIS Layer'])
  })
})

// ── Convenience wrappers ─────────────────────────────────────────────

describe('convenience flatten wrappers', () => {
  const layers: LayerProps[] = [group, pmtilesLayer, hiddenArcgis]

  it('flattenWmsLayers returns all WMS leaves (visibility-agnostic)', () => {
    expect(flattenWmsLayers(layers).map(l => l.title)).toEqual(['WMS Layer', 'Hidden WMS'])
  })

  it('flattenWfsLayers returns all WFS leaves', () => {
    expect(flattenWfsLayers(layers).map(l => l.title)).toEqual(['WFS Layer'])
  })

  it('flattenArcGisLayers returns all ArcGIS leaves', () => {
    expect(flattenArcGisLayers(layers).map(l => l.title)).toEqual(['ArcGIS Layer', 'Hidden ArcGIS'])
  })

  it('flattenDataLayers returns all WMS/WFS/PMTiles/ArcGIS leaves', () => {
    const result = flattenDataLayers(layers)
    expect(result.map(l => l.title)).toEqual(['WMS Layer', 'Hidden WMS', 'WFS Layer', 'ArcGIS Layer', 'PMTiles Layer', 'Hidden ArcGIS'])
  })
})

// ── flattenDataLayersWithParent ──────────────────────────────────────

describe('flattenDataLayersWithParent', () => {
  it('tags top-level layers with null parent', () => {
    const result = flattenDataLayersWithParent([wmsLayer, arcgisLayer])
    expect(result).toEqual([
      { layer: wmsLayer, parentGroupTitle: null },
      { layer: arcgisLayer, parentGroupTitle: null },
    ])
  })

  it('tags grouped layers with their group title', () => {
    const result = flattenDataLayersWithParent([group])
    expect(result).toHaveLength(4)
    expect(result.every(r => r.parentGroupTitle === 'Group')).toBe(true)
    expect(result.map(r => r.layer.title)).toEqual(['WMS Layer', 'Hidden WMS', 'WFS Layer', 'ArcGIS Layer'])
  })

  it('innermost group wins for nested groups', () => {
    const inner: GroupLayerProps = { type: 'group', title: 'Inner', layers: [wmsLayer] }
    const outer: GroupLayerProps = { type: 'group', title: 'Outer', layers: [inner] }
    const result = flattenDataLayersWithParent([outer])
    expect(result).toEqual([{ layer: wmsLayer, parentGroupTitle: 'Inner' }])
  })
})

// ── resolveLeafVisibility ────────────────────────────────────────────

describe('resolveLeafVisibility', () => {
  it('unchecked leaf is neither mounted nor displayed', () => {
    expect(resolveLeafVisibility('A', null, new Set(), new Map())).toEqual({ mounted: false, displayed: false })
  })

  it('checked top-level leaf is mounted and displayed', () => {
    expect(resolveLeafVisibility('A', null, new Set(['A']), new Map())).toEqual({ mounted: true, displayed: true })
  })

  it('checked grouped leaf with group toggle on is mounted and displayed', () => {
    const groupVis = new Map([['G', true]])
    expect(resolveLeafVisibility('A', 'G', new Set(['A']), groupVis)).toEqual({ mounted: true, displayed: true })
  })

  it('checked grouped leaf with group toggle off is mounted but not displayed', () => {
    const groupVis = new Map([['G', false]])
    expect(resolveLeafVisibility('A', 'G', new Set(['A']), groupVis)).toEqual({ mounted: true, displayed: false })
  })

  it('grouped leaf defaults to displayed when group has no toggle entry', () => {
    expect(resolveLeafVisibility('A', 'G', new Set(['A']), new Map())).toEqual({ mounted: true, displayed: true })
  })

  it('undefined title is never mounted', () => {
    expect(resolveLeafVisibility(undefined, null, new Set(['A']), new Map())).toEqual({ mounted: false, displayed: false })
  })
})
