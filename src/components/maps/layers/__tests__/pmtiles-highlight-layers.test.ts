import { describe, expect, it } from 'vitest'
import { pmtilesTileKey } from '../pmtiles-highlight-layers'

const point = { type: 'Point' as const, coordinates: [-111.9, 40.7] }

describe('pmtilesTileKey', () => {
  it('finds a feature by its tile id', () => {
    expect(pmtilesTileKey({ id: 97957, geometry: point, properties: {} })).toEqual({ by: 'id', value: 97957 })
  })

  it('finds a feature by ogc_fid when the query fell back to it', () => {
    expect(pmtilesTileKey({ id: 12, geometry: point, properties: { ogc_fid: 12 } })).toEqual({ by: 'ogc_fid', value: 12 })
  })

  it('gives up on a feature with no id, leaving it to the GeoJSON highlight', () => {
    expect(pmtilesTileKey({ id: 0, geometry: point, properties: {} })).toBeNull()
    expect(pmtilesTileKey({ id: '', geometry: point })).toBeNull()
    // Ids are cast from WFS data and can be missing at runtime
    expect(pmtilesTileKey({ id: undefined as unknown as string, geometry: point })).toBeNull()
  })
})
