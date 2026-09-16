import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/duckdb/client', () => ({
    escapeSql: (s: string) => s.replace(/'/g, "''"),
}))

import {
    resolveCrsIdentifier,
    reprojectToWgs84,
    assertGeographicBounds,
    readGeoParquetCrs,
    geoParquetMetadataSql,
} from '@/lib/map/user-layers/geoparquet-crs'

/** A connection returning one `geo` metadata document. */
function connWith(geoMetadata: string | undefined) {
    return {
        query: vi.fn(async () => ({
            toArray: () => (geoMetadata === undefined ? [] : [{ toJSON: () => ({ geo_metadata: geoMetadata }) }]),
        })),
    }
}

describe('resolveCrsIdentifier', () => {
    it('treats an absent crs as WGS84, per the GeoParquet spec', () => {
        expect(resolveCrsIdentifier(undefined)).toBeNull()
        expect(resolveCrsIdentifier(null)).toBeNull()
    })

    it('prefers an embedded authority code over the full PROJJSON document', () => {
        expect(resolveCrsIdentifier({
            type: 'ProjectedCRS',
            name: 'NAD83 / UTM zone 12N',
            id: { authority: 'EPSG', code: 26912 },
        })).toBe('EPSG:26912')
    })

    it('accepts a numeric or string code', () => {
        expect(resolveCrsIdentifier({ id: { authority: 'EPSG', code: '2100' } })).toBe('EPSG:2100')
    })

    it('does not ask for a transform when the file is already WGS84', () => {
        expect(resolveCrsIdentifier({ id: { authority: 'EPSG', code: 4326 } })).toBeNull()
        expect(resolveCrsIdentifier({ id: { authority: 'OGC', code: 'CRS84' } })).toBeNull()
        expect(resolveCrsIdentifier('EPSG:4326')).toBeNull()
        expect(resolveCrsIdentifier('OGC:CRS84')).toBeNull()
    })

    it('falls back to the whole PROJJSON document when no id is embedded', () => {
        const doc = { type: 'ProjectedCRS', name: 'Custom State Plane' }
        expect(resolveCrsIdentifier(doc)).toBe(JSON.stringify(doc))
    })

    it('passes a bare string through, as some older writers emit', () => {
        expect(resolveCrsIdentifier('EPSG:26912')).toBe('EPSG:26912')
        expect(resolveCrsIdentifier('   ')).toBeNull()
    })
})

describe('reprojectToWgs84', () => {
    it('leaves the expression alone when there is nothing to transform', () => {
        expect(reprojectToWgs84('ST_GeomFromWKB("geom")', null)).toBe('ST_GeomFromWKB("geom")')
    })

    it('normalises axis order via always_xy', () => {
        expect(reprojectToWgs84('g', 'EPSG:26912')).toBe("ST_Transform(g, 'EPSG:26912', 'EPSG:4326', true)")
    })

    it('escapes quotes in a PROJJSON document so the SQL cannot break', () => {
        const sql = reprojectToWgs84('g', `Custom's CRS`)
        expect(sql).toContain("'Custom''s CRS'")
    })
})

describe('assertGeographicBounds', () => {
    it('accepts lon/lat', () => {
        expect(() => assertGeographicBounds([-114, 37, -109, 42], 'wells')).not.toThrow()
    })

    it('accepts undefined bounds from an empty layer', () => {
        expect(() => assertGeographicBounds(undefined, 'wells')).not.toThrow()
    })

    it('rejects UTM metres rather than letting the layer draw nowhere', () => {
        // A Utah file in EPSG:26912 that declared no CRS.
        expect(() => assertGeographicBounds([400000, 4100000, 500000, 4600000], 'wells.parquet'))
            .toThrow(/projected coordinate system/)
    })

    it('names the layer and the magnitude so the cause is obvious', () => {
        expect(() => assertGeographicBounds([400000, 4100000, 500000, 4600000], 'wells.parquet'))
            .toThrow(/"wells\.parquet"/)
    })

    it('catches a latitude out of range even when longitude looks plausible', () => {
        expect(() => assertGeographicBounds([-114, 4100000, -109, 4600000], 'x')).toThrow()
    })
})

describe('readGeoParquetCrs', () => {
    it('reads the geometry column the loader settled on', async () => {
        const conn = connWith(JSON.stringify({
            primary_column: 'geom',
            columns: { geom: { crs: { id: { authority: 'EPSG', code: 2100 } } } },
        }))
        expect(await readGeoParquetCrs(conn, 'f.parquet', 'geom')).toBe('EPSG:2100')
    })

    it('falls back to the primary column, then to the first one', async () => {
        const conn = connWith(JSON.stringify({
            primary_column: 'geometry',
            columns: { geometry: { crs: { id: { authority: 'EPSG', code: 3857 } } } },
        }))
        expect(await readGeoParquetCrs(conn, 'f.parquet')).toBe('EPSG:3857')
    })

    it('returns null for a plain Parquet with no geo block', async () => {
        expect(await readGeoParquetCrs(connWith(undefined), 'f.parquet')).toBeNull()
    })

    it('does not throw when the metadata is unparseable', async () => {
        expect(await readGeoParquetCrs(connWith('{not json'), 'f.parquet')).toBeNull()
    })

    it('does not throw when the metadata query itself fails', async () => {
        const conn = { query: vi.fn().mockRejectedValue(new Error('no such function')) }
        expect(await readGeoParquetCrs(conn, 'f.parquet')).toBeNull()
    })

    it('matches the geo key as a blob so a non-UTF-8 key cannot fail the read', () => {
        expect(geoParquetMetadataSql('f.parquet')).toContain("key = encode('geo')")
    })
})
