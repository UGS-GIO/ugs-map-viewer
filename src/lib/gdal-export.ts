/**
 * GDAL/OGR in the browser. DuckDB-WASM's GDAL writers are broken (duckdb-spatial#363,
 * open since 2024); gdal3.js is a full GDAL whose drivers work, including OpenFileGDB.
 * Takes DuckDB-built GeoJSON → GPKG / SHP / GDB / FlatGeobuf.
 *
 * Ported from ugs-warehouse `viewer/src/gdal.ts`; keep the two in sync.
 */
import { unzipSync, zipSync } from 'fflate'
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

// .gdb files stay nested under `<stem>.gdb/`; shapefile sidecars (one set per `shpStems`) sit at the zip root.
async function zipOutputs(gdal: Gdal, stem: string, target: GdalTarget, shpStems: string[], gdbPath = stem): Promise<GdalConversion> {
    const entries: Record<string, Uint8Array> = {}
    for (const f of await gdal.getOutputFiles()) {
        const name = basename(f.path)
        if (target.ext === 'gdb' && f.path.includes(`${gdbPath}.gdb/`)) {
            entries[`${stem}.gdb/${name}`] = await gdal.getFileBytes(f.path)
        } else if (target.ext === 'shp' && shpStems.some(s => name.startsWith(`${s}.`))) {
            entries[name] = await gdal.getFileBytes(f.path)
        }
    }
    return { bytes: zipSync(entries), filename: `${stem}.${target.ext}.zip`, mime: 'application/zip' }
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

        return await zipOutputs(gdal, stem, target, [stem])
    } finally {
        try { await gdal.close(ds) } catch { /* best-effort */ }
    }
}

const gdalMessage = (e: unknown) =>
    e instanceof Error ? e.message : Array.isArray(e) ? e.map(m => m?.message).filter(Boolean).join(' ') || 'GDAL error' : String(e)

// This GDAL build has no LIBKML, so its KML driver can't read a KMZ (a zip around a .kml)
async function kmzToKml(file: File) {
    if (!/\.kmz$/i.test(file.name)) return file
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: f => /\.kml$/i.test(f.name) })
    const [name, bytes] = Object.entries(entries)[0] ?? []
    return name && bytes ? new File([bytes], name.split('/').pop() ?? name) : file
}

/**
 * Every layer of any OGR-readable file (zipped Shapefiles or File Geodatabase, GeoPackage, KML, …)
 * as one GeoJSON FeatureCollection in WGS84. GeoJSON output holds one layer, so each is converted
 * on its own. A file with no declared CRS can't be placed, so ogr2ogr's error stands.
 */
export async function readAsGeoJSON(file: File): Promise<{ type: 'FeatureCollection'; features: unknown[] }> {
    const gdal = await getGdal()
    // gdal3.js rejects with [{ no, message }], not an Error
    const { datasets } = await gdal.open(await kmzToKml(file)).catch(() => ({ datasets: [] }))
    if (!datasets.length) throw new Error(`Couldn't open "${file.name}".`)
    const features: unknown[] = []
    try {
        for (const [d, ds] of datasets.entries()) {
            const layers = (await gdal.getInfo(ds)).layers ?? []
            for (const [l, layer] of layers.entries()) {
                const out = await gdal.ogr2ogr(ds, ['-f', 'GeoJSON', '-t_srs', 'EPSG:4326', layer.name], `read-${d}-${l}.geojson`)
                    .catch((e: unknown) => { throw new Error(`Couldn't read layer "${layer.name}" of "${file.name}": ${gdalMessage(e)}`) })
                const json: unknown = JSON.parse(new TextDecoder().decode(await gdal.getFileBytes(out)))
                if (typeof json === 'object' && json !== null && 'features' in json && Array.isArray(json.features)) features.push(...json.features)
            }
        }
    } finally {
        for (const ds of datasets) {
            try { await gdal.close(ds) } catch { /* best-effort */ }
        }
    }
    return { type: 'FeatureCollection', features }
}

let layeredRuns = 0

/**
 * Named GeoJSON layers (WGS84) → one `target` file with a layer each, for formats that hold one
 * geometry type per layer. Shapefile has no layers, so each becomes its own `<stem>_<name>.shp`.
 */
export async function convertGeoJSONLayers(layers: [name: string, geojson: string][], stem: string, target: GdalTarget): Promise<GdalConversion> {
    const gdal = await getGdal()
    const shp = target.ext === 'shp'
    const stems = layers.map(([name]) => `${stem}_${name}`)
    // A fresh path each time: an earlier export's file would keep layers this one doesn't have
    const path = `${stem}-${++layeredRuns}`
    const opened: Awaited<ReturnType<Gdal['open']>>['datasets'] = []
    try {
        let out
        for (const [i, [name, geojson]] of layers.entries()) {
            const { datasets } = await gdal.open(new File([geojson], `${name}.geojson`, { type: 'application/geo+json' }))
            opened.push(...datasets)
            const args = ['-f', target.driver, '-nln', shp ? stems[i] : name, ...(i && !shp ? ['-update', '-append'] : [])]
            // gdal3.js adds the extension
            out = await gdal.ogr2ogr(datasets[0], args, shp ? stems[i] : path)
        }
        if (!out) throw new Error('Nothing to export.')
        if (!target.multi) return { bytes: await gdal.getFileBytes(out), filename: `${stem}.${target.ext}`, mime: 'application/octet-stream' }
        return await zipOutputs(gdal, stem, target, stems, path)
    } finally {
        for (const ds of opened) {
            try { await gdal.close(ds) } catch { /* best-effort */ }
        }
    }
}
