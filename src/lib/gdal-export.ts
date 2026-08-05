/**
 * GDAL/OGR in the browser. DuckDB-WASM's GDAL writers are broken (duckdb-spatial#363,
 * open since 2024); gdal3.js is a full GDAL whose drivers work, including OpenFileGDB.
 * Takes DuckDB-built GeoJSON → GPKG / SHP / GDB / FlatGeobuf.
 *
 * Ported from ugs-warehouse `viewer/src/gdal.ts`; keep the two in sync.
 */
import { zipSync } from 'fflate'
import initGdalJs from 'gdal3.js'
import dataUrl from 'gdal3.js/dist/package/gdal3WebAssembly.data?url'
import wasmUrl from 'gdal3.js/dist/package/gdal3WebAssembly.wasm?url'

export interface GdalTarget {
    driver: string
    ext: string
    /** Emits several files (shp sidecars, the .gdb directory) which we zip. */
    multi: boolean
}

export const GDAL_TARGETS: Record<string, GdalTarget> = {
    gpkg: { driver: 'GPKG', ext: 'gpkg', multi: false },
    fgb: { driver: 'FlatGeobuf', ext: 'fgb', multi: false },
    shp: { driver: 'ESRI Shapefile', ext: 'shp', multi: true },
    gdb: { driver: 'OpenFileGDB', ext: 'gdb', multi: true },
}

type Gdal = Awaited<ReturnType<typeof initGdalJs>>
let gdalPromise: Promise<Gdal> | null = null

// Memoized: the ~40MB payload loads once per page, not per download.
function getGdal(): Promise<Gdal> {
    if (!gdalPromise) {
        gdalPromise = initGdalJs({
            paths: { wasm: wasmUrl, data: dataUrl },
            useWorker: false,
            // GDAL's non-fatal stderr (field-type coercion, name laundering) is warnings, not errors.
            errorHandler: (m: string) => console.warn(m),
        })
    }
    return gdalPromise
}

const basename = (p: string) => p.split('/').pop() ?? p

export interface GdalConversion {
    bytes: Uint8Array
    filename: string
    mime: string
}

/**
 * GeoJSON (WGS84) → `target`, reprojected to `epsg`. `floatCols` get an OGR-SQL CAST:
 * GDAL otherwise reads a whole-valued float column as Integer, downcasting depths.
 */
export async function convertGeoJSON(
    geojson: string,
    stem: string,
    target: GdalTarget,
    epsg = 4326,
    cols: string[] = [],
    floatCols: string[] = [],
): Promise<GdalConversion> {
    const gdal = await getGdal()
    const input = new File([geojson], 'in.geojson', { type: 'application/geo+json' })
    const { datasets } = await gdal.open(input)
    const ds = datasets[0]
    // Shapefile takes the bare stem — the driver appends .shp/.dbf/…
    const outName = target.ext === 'shp' ? stem : `${stem}.${target.ext}`
    // -nln names the layer after the dataset, else it inherits "in" from in.geojson.
    const args = ['-f', target.driver, '-t_srs', `EPSG:${epsg}`, '-nln', stem]
    if (floatCols.length && cols.length) {
        const fset = new Set(floatCols)
        const q = (c: string) => `"${c.replace(/"/g, '""')}"`
        // Geometry passes through OGR SQL implicitly.
        const sel = cols.map(c => (fset.has(c) ? `CAST(${q(c)} AS float(24,10)) AS ${q(c)}` : q(c))).join(', ')
        args.push('-sql', `SELECT ${sel} FROM "in"`)
    }
    const result = await gdal.ogr2ogr(ds, args, outName)

    // try/finally so the early return still closes the dataset — otherwise gpkg/fgb
    // exports leak the handle + MEMFS buffers into the GDAL heap.
    try {
        if (!target.multi) {
            const bytes = await gdal.getFileBytes(result)
            return { bytes, filename: `${stem}.${target.ext}`, mime: 'application/octet-stream' }
        }

        // .gdb files stay nested under `<stem>.gdb/`; shapefile sidecars sit at the zip root.
        const outputs = await gdal.getOutputFiles()
        const entries: Record<string, Uint8Array> = {}
        for (const f of outputs) {
            const name = basename(f.path)
            if (target.ext === 'gdb' && f.path.includes(`${stem}.gdb`)) {
                entries[`${stem}.gdb/${name}`] = await gdal.getFileBytes(f.path)
            } else if (target.ext === 'shp' && name.startsWith(`${stem}.`)) {
                entries[name] = await gdal.getFileBytes(f.path)
            }
        }
        return { bytes: zipSync(entries), filename: `${stem}.${target.ext}.zip`, mime: 'application/zip' }
    } finally {
        try { await gdal.close(ds) } catch { /* best-effort */ }
    }
}

/**
 * Shapefile field-name limits: names > 10 chars are truncated, two that collapse to the
 * same 10 chars silently lose a column, and 255 fields is a hard cap.
 */
export function shapefileFieldChecks(cols: string[]): {
    longNames: string[]
    collisions: [string, string][]
    fieldCount: number
    tooManyFields: boolean
} {
    const longNames = cols.filter(c => c.length > 10)
    const seen = new Map<string, string>()
    const collisions: [string, string][] = []
    for (const c of cols) {
        const key = c.slice(0, 10).toLowerCase()
        if (seen.has(key)) collisions.push([seen.get(key)!, c])
        else seen.set(key, c)
    }
    return { longNames, collisions, fieldCount: cols.length, tooManyFields: cols.length > 255 }
}
