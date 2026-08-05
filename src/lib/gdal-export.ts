/**
 * Real GDAL/OGR in the browser (gdal3.js). DuckDB-WASM's GDAL output drivers are
 * broken — see duckdb-spatial#363 / duckdb-wasm#1840, open since 2024 — but gdal3.js
 * bundles a full GDAL build whose OGR drivers write correctly, including OpenFileGDB
 * (Esri File Geodatabase, write support since GDAL 3.6). We feed it a GeoJSON produced
 * by DuckDB and convert to GPKG / SHP / GDB / FlatGeobuf.
 *
 * Ported from ugs-warehouse `viewer/src/gdal.ts`; keep the two in sync.
 */
import { zipSync } from 'fflate'
import initGdalJs from 'gdal3.js'
import dataUrl from 'gdal3.js/dist/package/gdal3WebAssembly.data?url'
import wasmUrl from 'gdal3.js/dist/package/gdal3WebAssembly.wasm?url'

export interface GdalTarget {
    /** OGR driver name */
    driver: string
    /** File extension (no dot) */
    ext: string
    /** Emits several files (shp sidecars, the .gdb directory) which we zip */
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

// Memoized: the ~40MB wasm + data payload loads once per page, not per download.
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
 * Convert a GeoJSON string (WGS84) to `target`, reprojecting to `epsg` (default 4326).
 *
 * `cols` (all attribute columns) + `floatCols` (the DOUBLE/REAL ones) force real typing:
 * GDAL's GeoJSON reader otherwise infers Integer for a float column whose values happen
 * to be whole, silently downcasting depth/elevation fields. An OGR-SQL CAST fixes it.
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
    // Shapefile: pass the bare stem (the driver appends .shp/.dbf/… — giving `stem.shp`
    // would double to `stem.shp.shp`). Other drivers want the full filename.
    const outName = target.ext === 'shp' ? stem : `${stem}.${target.ext}`
    // -nln names the output layer after the dataset (else it inherits "in" from in.geojson).
    const args = ['-f', target.driver, '-t_srs', `EPSG:${epsg}`, '-nln', stem]
    if (floatCols.length && cols.length) {
        const fset = new Set(floatCols)
        const q = (c: string) => `"${c.replace(/"/g, '""')}"`
        // Geometry passes through OGR SQL implicitly; CAST only the whole-valued float columns.
        const sel = cols.map(c => (fset.has(c) ? `CAST(${q(c)} AS float(24,10)) AS ${q(c)}` : q(c))).join(', ')
        args.push('-sql', `SELECT ${sel} FROM "in"`)
    }
    const result = await gdal.ogr2ogr(ds, args, outName)

    // try/finally so the single-file early return still closes the dataset (else gpkg/fgb
    // exports leak the handle + MEMFS buffers into the GDAL runtime heap).
    try {
        if (!target.multi) {
            const bytes = await gdal.getFileBytes(result)
            return { bytes, filename: `${stem}.${target.ext}`, mime: 'application/octet-stream' }
        }

        // Multi-file: collect the format's output files and zip. For a .gdb directory keep
        // the files nested under `<stem>.gdb/`; shapefile sidecars sit at the zip root.
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
 * Deterministic shapefile field-name limits (pure — no data read). Names > 10 chars get
 * truncated by the driver; two that collapse to the same 10-char name collide, losing a
 * column silently; > 255 fields is a hard cap.
 *
 * Ported from ugs-warehouse `viewer/src/download.ts`.
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
