import { describe, it, expect } from 'vitest'
import { queryPmtilesLayersInScreenBbox, buildPmtilesLayerSpecs } from '../pmtiles-layer-source'
import type { PMTilesLayerProps } from '@/lib/types/mapping-types'

const BBOX: [[number, number], [number, number]] = [[0, 0], [100, 100]]
const layers = [{ title: 'UCRC Inventory' }] as PMTilesLayerProps[]

/** Minimal MapLibre stand-in: two style sublayers of one PMTiles layer, plus an unrelated one. */
function fakeMap(features: unknown[]) {
    const styleLayers = [
        { id: 'ucrc-circle', metadata: { pmtilesLayer: true, title: 'UCRC Inventory' } },
        { id: 'ucrc-symbol', metadata: { pmtilesLayer: true, title: 'UCRC Inventory' } },
        { id: 'basemap-roads', metadata: undefined },
        { id: 'other-pmtiles', metadata: { pmtilesLayer: true, title: 'Power Plants' } },
    ]
    const queried: Array<string[] | undefined> = []
    return {
        queried,
        getStyle: () => ({ layers: styleLayers }),
        getLayer: (id: string) => styleLayers.find(l => l.id === id),
        queryRenderedFeatures: (_bbox: unknown, opts: { layers?: string[] }) => {
            queried.push(opts?.layers)
            return features
        },
    } as never
}

const feat = (id: unknown, props: Record<string, unknown>, coords: number[] = [0, 0], layer = 'ucrc-circle') =>
    ({ id, properties: props, geometry: { type: 'Point', coordinates: coords }, layer: { id: layer } })

describe('queryPmtilesLayersInScreenBbox', () => {
    it('returns nothing when no PMTiles layers are visible', () => {
        expect(queryPmtilesLayersInScreenBbox(fakeMap([feat(1, {})]), BBOX, [])).toEqual([])
    })

    it('only queries style sublayers belonging to the visible layers', () => {
        const map = fakeMap([])
        queryPmtilesLayersInScreenBbox(map, BBOX, layers)
        expect((map as unknown as { queried: string[][] }).queried[0]).toEqual(['ucrc-circle', 'ucrc-symbol'])
    })

    it('dedupes a feature returned once per tile and once per style sublayer', () => {
        // Same feature id 42, three hits: two style sublayers plus a tile-boundary repeat.
        const rows = queryPmtilesLayersInScreenBbox(fakeMap([
            feat(42, { uwi: 'a' }, [0, 0], 'ucrc-circle'),
            feat(42, { uwi: 'a' }, [0, 0], 'ucrc-symbol'),
            feat(42, { uwi: 'a' }, [0, 0], 'ucrc-circle'),
            feat(43, { uwi: 'b' }),
        ]), BBOX, layers)
        expect(rows.map(r => r.id)).toEqual([42, 43])
        expect(rows[0].layerTitle).toBe('UCRC Inventory')
    })

    it('falls back to ogc_fid when the tile carries no feature id', () => {
        const rows = queryPmtilesLayersInScreenBbox(fakeMap([
            feat(undefined, { ogc_fid: 7 }),
            feat(undefined, { ogc_fid: 7 }),
        ]), BBOX, layers)
        expect(rows).toHaveLength(1)
        expect(rows[0].id).toBe(7)
    })

    it('keeps unkeyed features that share attributes but sit at different locations', () => {
        // Without the geometry signature these two collapse into one — distinct wells with
        // identical popup fields is exactly the case a properties-only key gets wrong.
        const rows = queryPmtilesLayersInScreenBbox(fakeMap([
            feat(undefined, { box_type: 'CORE' }, [-112.9, 39.0]),
            feat(undefined, { box_type: 'CORE' }, [-111.5, 40.2]),
            feat(undefined, { box_type: 'CORE' }, [-112.9, 39.0]),  // true duplicate
        ]), BBOX, layers)
        expect(rows).toHaveLength(2)
    })
})

// ── buildPmtilesLayerSpecs ───────────────────────────────────────────

/** The real PLSS Sections fragment shape: both sublayers carry a minzoom. */
const sectionsFragment = {
    layers: [
        { id: 'enmin_plss_sections-0', type: 'line' as const, minzoom: 11.126916814491269, paint: { 'line-color': '#000000' } },
        { id: 'enmin_plss_sections-1', type: 'symbol' as const, minzoom: 11.126916814491269, layout: { 'text-field': '{frstdivlab}' }, paint: { 'text-color': '#000000' } },
    ],
}
const sectionsLayer = {
    title: 'Sections',
    sourceLayer: 'enmin_plss_sections',
    visibleZoomRange: [11, 22] as [number, number],
} as PMTilesLayerProps

/** react-map-gl's LayerProps is a union (incl. custom layers); read specs as plain records. */
type SpecRecord = Record<string, unknown>
function specsOf(args: Parameters<typeof buildPmtilesLayerSpecs>[0]): SpecRecord[] {
    return buildPmtilesLayerSpecs(args) as unknown as SpecRecord[]
}
const sub = (spec: SpecRecord, key: string): SpecRecord => (spec[key] ?? {}) as SpecRecord

describe('buildPmtilesLayerSpecs', () => {
    it("carries the fragment's zoom gate onto every sublayer — the reason Sections drew at all zooms", () => {
        const specs = specsOf({ layer: { ...sectionsLayer, visibleZoomRange: undefined }, fragment: sectionsFragment })
        expect(specs.map(s => s.minzoom)).toEqual([11.126916814491269, 11.126916814491269])
    })

    it("lets the config visibleZoomRange win over the fragment's zoom", () => {
        const specs = specsOf({ layer: sectionsLayer, fragment: sectionsFragment })
        expect(specs.map(s => [s.minzoom, s.maxzoom])).toEqual([[11, 22], [11, 22]])
    })

    it('leaves a fragment with no zoom gate ungated', () => {
        const specs = specsOf({
            layer: { title: 'Wells', sourceLayer: 'enmin_ucrc_wells' } as PMTilesLayerProps,
            fragment: { layers: [{ id: 'w-0', type: 'circle' as const, paint: { 'circle-radius': 3 } }] },
        })
        expect(specs[0].minzoom).toBeUndefined()
        expect(specs[0].maxzoom).toBeUndefined()
    })

    it('keeps the viewer-owned id, source, visibility, opacity and metadata', () => {
        const specs = specsOf({ layer: sectionsLayer, fragment: sectionsFragment, hidden: true, opacity: 0.5 })
        expect(specs.map(s => s.id)).toEqual(['pmtiles-layer-Sections', 'pmtiles-layer-Sections-1'])
        expect(specs[0].source).toBe('pmtiles-sections')
        expect(specs[0]['source-layer']).toBe('enmin_plss_sections')
        expect(sub(specs[0], 'layout').visibility).toBe('none')
        expect(sub(specs[0], 'paint')['line-opacity']).toBe(0.5)
        expect(specs[0].metadata).toEqual({ title: 'Sections', pmtilesLayer: true, pmtilesSourceId: 'pmtiles-sections' })
        // The symbol sublayer keeps its own layout keys alongside the forced visibility.
        expect(sub(specs[1], 'layout')['text-field']).toBe('{frstdivlab}')
    })

    it("merges the fragment's filter with the user filter", () => {
        const specs = specsOf({
            layer: sectionsLayer,
            fragment: { layers: [{ id: 'a', type: 'line' as const, filter: ['==', 'a', 1], paint: {} }] },
            layerFilter: ['==', 'b', 2] as never,
        })
        expect(specs[0].filter).toEqual(['all', ['==', 'a', 1], ['==', 'b', 2]])
    })
})
