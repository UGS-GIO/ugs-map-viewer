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
  flattenDataLayersWithAncestors,
  resolveLeafVisibility,
  findAncestorGroupTitles,
  buildFragmentLayerSpec,
  zoomRangeToBounds,
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

// ── flattenDataLayersWithAncestors ──────────────────────────────────────

describe('flattenDataLayersWithAncestors', () => {
  it('tags top-level layers with no enclosing groups', () => {
    const result = flattenDataLayersWithAncestors([wmsLayer, arcgisLayer])
    expect(result).toEqual([
      { layer: wmsLayer, ancestorGroupTitles: [] },
      { layer: arcgisLayer, ancestorGroupTitles: [] },
    ])
  })

  it('tags grouped layers with their group title', () => {
    const result = flattenDataLayersWithAncestors([group])
    expect(result).toHaveLength(4)
    expect(result.every(r => r.ancestorGroupTitles.join() === 'Group')).toBe(true)
    expect(result.map(r => r.layer.title)).toEqual(['WMS Layer', 'Hidden WMS', 'WFS Layer', 'ArcGIS Layer'])
  })

  it('tags nested leaves with every enclosing group, outermost first', () => {
    const inner: GroupLayerProps = { type: 'group', title: 'Inner', layers: [wmsLayer] }
    const outer: GroupLayerProps = { type: 'group', title: 'Outer', layers: [inner] }
    const result = flattenDataLayersWithAncestors([outer])
    expect(result).toEqual([{ layer: wmsLayer, ancestorGroupTitles: ['Outer', 'Inner'] }])
  })
})

// ── resolveLeafVisibility ────────────────────────────────────────────

describe('resolveLeafVisibility', () => {
  it('unchecked leaf is neither mounted nor displayed', () => {
    expect(resolveLeafVisibility('A', [], new Set(), new Map())).toEqual({ mounted: false, displayed: false })
  })

  it('checked top-level leaf is mounted and displayed', () => {
    expect(resolveLeafVisibility('A', [], new Set(['A']), new Map())).toEqual({ mounted: true, displayed: true })
  })

  it('checked grouped leaf with group toggle on is mounted and displayed', () => {
    const groupVis = new Map([['G', true]])
    expect(resolveLeafVisibility('A', ['G'], new Set(['A']), groupVis)).toEqual({ mounted: true, displayed: true })
  })

  it('checked grouped leaf with group toggle off is mounted but not displayed', () => {
    const groupVis = new Map([['G', false]])
    expect(resolveLeafVisibility('A', ['G'], new Set(['A']), groupVis)).toEqual({ mounted: true, displayed: false })
  })

  it('grouped leaf defaults to displayed when group has no toggle entry', () => {
    expect(resolveLeafVisibility('A', ['G'], new Set(['A']), new Map())).toEqual({ mounted: true, displayed: true })
  })

  it('nested leaf is hidden when an outer group is off, even with the inner group on', () => {
    const groupVis = new Map([['Outer', false], ['Inner', true]])
    expect(resolveLeafVisibility('A', ['Outer', 'Inner'], new Set(['A']), groupVis))
      .toEqual({ mounted: true, displayed: false })
  })

  it('nested leaf is displayed when every enclosing group is on', () => {
    const groupVis = new Map([['Outer', true], ['Inner', true]])
    expect(resolveLeafVisibility('A', ['Outer', 'Inner'], new Set(['A']), groupVis))
      .toEqual({ mounted: true, displayed: true })
  })

  it('undefined title is never mounted', () => {
    expect(resolveLeafVisibility(undefined, [], new Set(['A']), new Map())).toEqual({ mounted: false, displayed: false })
  })
})

// ── findAncestorGroupTitles / findParentGroupTitle ───────────────────

describe('findAncestorGroupTitles', () => {
  const inner: GroupLayerProps = { type: 'group', title: 'Inner', layers: [wmsLayer] }
  const outer: GroupLayerProps = { type: 'group', title: 'Outer', layers: [inner] }
  const tree: LayerProps[] = [wfsLayer, outer]

  it('returns groups outermost first for a nested leaf', () => {
    expect(findAncestorGroupTitles(tree, 'WMS Layer')).toEqual(['Outer', 'Inner'])
  })

  it('returns no groups for a top-level leaf', () => {
    expect(findAncestorGroupTitles(tree, 'WFS Layer')).toEqual([])
  })

  it('returns no groups for a missing title', () => {
    expect(findAncestorGroupTitles(tree, 'Nope')).toEqual([])
  })

  it('returns the ancestors of a group itself', () => {
    expect(findAncestorGroupTitles(tree, 'Inner')).toEqual(['Outer'])
  })
})

// ── zoomRangeToBounds ────────────────────────────────────────────────

describe('zoomRangeToBounds', () => {
  it('returns empty when no range is set', () => {
    expect(zoomRangeToBounds(undefined)).toEqual({})
  })

  it('maps [min, max] to minzoom/maxzoom, keeping a 0 bound', () => {
    // Direct indexing (not `||`) so a legitimate zoom-0 min survives.
    expect(zoomRangeToBounds([0, 12] as [number, number])).toEqual({ minzoom: 0, maxzoom: 12 })
  })
})

// ── buildFragmentLayerSpec ───────────────────────────────────────────

describe('buildFragmentLayerSpec', () => {
  const opts = {
    layerId: 'pmtiles-layer-Sections',
    sourceId: 'pmtiles-sections',
    sourceLayer: 'enmin_plss_sections',
    metadata: { title: 'Sections', pmtilesLayer: true, pmtilesSourceId: 'pmtiles-sections' },
    visible: true,
  }

  it('preserves every rendering property the fragment authored, including minzoom and unknown keys', () => {
    // The regression guard: whatever a ugs-styles fragment sets must survive, so
    // the next new property (or layer) can't silently vanish the way minzoom did.
    const spec = buildFragmentLayerSpec(
      {
        id: 'frag-0',
        type: 'line',
        minzoom: 11.13,
        paint: { 'line-color': '#000', 'line-width': 1 },
        futureProp: 'keep-me',
      },
      opts,
    )
    expect(spec.type).toBe('line')
    expect(spec.minzoom).toBe(11.13)
    expect(spec.paint).toEqual({ 'line-color': '#000', 'line-width': 1 })
    expect(spec.futureProp).toBe('keep-me')
  })

  it('overrides id and source with the injected viewer values', () => {
    const spec = buildFragmentLayerSpec(
      { id: 'frag-0', type: 'line', source: 'stale-source', paint: {} },
      opts,
    )
    expect(spec.id).toBe(opts.layerId)
    expect(spec.source).toBe(opts.sourceId)
  })

  it("injects the config source-layer when the fragment omits it, else keeps the fragment's", () => {
    const injected = buildFragmentLayerSpec({ id: 'a', type: 'line', paint: {} }, opts)
    expect(injected['source-layer']).toBe('enmin_plss_sections')
    const authored = buildFragmentLayerSpec(
      { id: 'a', type: 'line', 'source-layer': 'other', paint: {} },
      opts,
    )
    expect(authored['source-layer']).toBe('other')
  })

  it('forces layout.visibility from `visible` while preserving other layout keys', () => {
    const spec = buildFragmentLayerSpec(
      { id: 'a', type: 'symbol', layout: { 'text-field': '{lab}', 'symbol-placement': 'point' }, paint: {} },
      { ...opts, visible: false },
    )
    expect(spec.layout).toEqual({
      'text-field': '{lab}',
      'symbol-placement': 'point',
      visibility: 'none',
    })
  })

  it('keeps viewer metadata authoritative — fragment metadata does not leak through', () => {
    const spec = buildFragmentLayerSpec(
      { id: 'a', type: 'line', paint: {}, metadata: { legendHint: 'nope' } },
      opts,
    )
    expect(spec.metadata).toEqual(opts.metadata)
  })

  it("takes the viewer's recomputed paint and filter, and keeps the fragment's when omitted", () => {
    const overridden = buildFragmentLayerSpec(
      { id: 'a', type: 'line', paint: { 'line-opacity': 1 }, filter: ['==', 'a', 1] },
      { ...opts, paint: { 'line-opacity': 0.4 }, filter: ['all', ['==', 'a', 1], ['==', 'b', 2]] },
    )
    expect(overridden.paint).toEqual({ 'line-opacity': 0.4 })
    expect(overridden.filter).toEqual(['all', ['==', 'a', 1], ['==', 'b', 2]])

    const kept = buildFragmentLayerSpec(
      { id: 'a', type: 'line', paint: { 'line-opacity': 1 }, filter: ['==', 'a', 1] },
      opts,
    )
    expect(kept.paint).toEqual({ 'line-opacity': 1 })
    expect(kept.filter).toEqual(['==', 'a', 1])
  })

  it("lets the config visibleZoomRange override the fragment's own minzoom", () => {
    const spec = buildFragmentLayerSpec(
      { id: 'a', type: 'line', minzoom: 11.13, paint: {} },
      { ...opts, visibleZoomRange: [13, 20] as [number, number] },
    )
    expect(spec.minzoom).toBe(13)
    expect(spec.maxzoom).toBe(20)
  })
})
