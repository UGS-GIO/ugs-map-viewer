import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unzipSync } from 'fflate'

const outputFiles: Array<{ path: string; size: number }> = []
const fileBytes = new Map<string, Uint8Array>()
const ogr2ogrCalls: Array<{ args: string[]; outputName: string }> = []

vi.mock('gdal3.js/dist/package/gdal3WebAssembly.data?url', () => ({ default: '/fake.data' }))
vi.mock('gdal3.js/dist/package/gdal3WebAssembly.wasm?url', () => ({ default: '/fake.wasm' }))
vi.mock('gdal3.js', () => ({
    default: vi.fn(async () => ({
        open: vi.fn(async () => ({ datasets: [{ id: 1 }] })),
        close: vi.fn(async () => {}),
        ogr2ogr: vi.fn(async (_ds: unknown, args: string[], outputName: string) => {
            ogr2ogrCalls.push({ args, outputName })
            // Mirrors gdal3.js/src/allJsFunctions/application/ogr2ogr.js: appends `.${driver.extension}`
            const fIdx = args.indexOf('-f')
            const driver = fIdx >= 0 ? args[fIdx + 1] : ''
            const ext = driver === 'OpenFileGDB' ? 'gdb' : driver === 'ESRI Shapefile' ? 'shp' : 'gpkg'
            const localPath = `/output/${outputName}.${ext}`
            if (ext === 'gdb') {
                const tablePath = `${localPath}/a00000001.gdbtable`
                const markerPath = `${localPath}/gdb`
                const tableBytes = new Uint8Array([1, 2, 3, 4])
                const markerBytes = new Uint8Array([70, 0, 0, 0])
                outputFiles.push(
                    { path: tablePath, size: tableBytes.length },
                    { path: markerPath, size: markerBytes.length },
                )
                fileBytes.set(tablePath, tableBytes)
                fileBytes.set(markerPath, markerBytes)
            }
            return { local: localPath, real: localPath }
        }),
        getOutputFiles: vi.fn(async () => [...outputFiles]),
        getFileBytes: vi.fn(async (p: string | { local: string }) => {
            const key = typeof p === 'string' ? p : p.local
            const bytes = fileBytes.get(key)
            if (!bytes) throw new Error(`missing ${key}`)
            return bytes
        }),
    })),
}))

import { convertGeoJSON, GDAL_TARGETS } from '../gdal-export'

describe('convertGeoJSON (OpenFileGDB)', () => {
    beforeEach(() => {
        outputFiles.length = 0
        fileBytes.clear()
        ogr2ogrCalls.length = 0
    })

    it('passes extensionless outputName to ogr2ogr and zips .gdb contents under <stem>.gdb/', async () => {
        const res = await convertGeoJSON('{"type":"FeatureCollection","features":[]}', 'utah-faults', GDAL_TARGETS.gdb)

        expect(ogr2ogrCalls).toHaveLength(1)
        expect(ogr2ogrCalls[0].outputName).not.toMatch(/\.gdb$/)
        expect(res.filename).toBe('utah-faults.gdb.zip')

        const entries = unzipSync(res.bytes)
        expect(Object.keys(entries).sort()).toEqual(['utah-faults.gdb/a00000001.gdbtable', 'utah-faults.gdb/gdb'])
        expect(entries['utah-faults.gdb/a00000001.gdbtable']).toEqual(new Uint8Array([1, 2, 3, 4]))
    })

    it('fails loud instead of returning an empty zip when no matching output files exist', async () => {
        await expect(
            convertGeoJSON('{"type":"FeatureCollection","features":[]}', 'utah-faults', GDAL_TARGETS.shp),
        ).rejects.toThrow(/GDAL produced no shp output files/)
    })
})
