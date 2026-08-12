import { describe, it, expect } from 'vitest'
import { queryPmtilesLayersInScreenBbox } from '../pmtiles-layer-source'
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
