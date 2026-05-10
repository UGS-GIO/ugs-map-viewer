import { stringify as geojsonToWKT } from 'wellknown'
import { zipSync, strToU8 } from 'fflate'
import { downloadZip as clientStreamingZip } from 'client-zip'

export { geojsonToWKT }

/**
 * Build CSV string from rows + headers without triggering a download.
 * Use when bundling multiple CSVs into a zip.
 */
export function buildCSV<T>(
  data: T[],
  headers: string[],
  getValue: (row: T, key: string) => unknown,
): string {
  return [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = getValue(row, h)
          if (val == null) return ''
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    ),
  ].join('\n')
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download data as CSV file
 */
export function downloadCSV<T>(
  data: T[],
  filename: string,
  headers: string[],
  getValue: (row: T, key: string) => unknown
) {
  downloadCsvString(buildCSV(data, headers, getValue), filename)
}

/**
 * Trigger a CSV download from a pre-built string. Use when the CSV is built
 * elsewhere (e.g., via buildCSV when bundling into a zip but bailing on bundle).
 */
export function downloadCsvString(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

/**
 * Strip filesystem-unsafe chars while preserving readable separators (`_.-`).
 * Use for download filenames built from user-facing labels.
 */
export const sanitizeFilename = (input: string): string =>
  input.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '')

/**
 * Download a set of named files bundled into a single zip.
 * Values may be strings (encoded UTF-8) or raw bytes.
 */
export function downloadZip(files: Record<string, string | Uint8Array>, filename: string): void {
  const entries: Record<string, Uint8Array> = {}
  for (const [name, content] of Object.entries(files)) {
    entries[name] = typeof content === 'string' ? strToU8(content) : content
  }
  const zipped = zipSync(entries)
  // Copy into a fresh ArrayBuffer to satisfy the Blob constructor's BlobPart typing
  // (some TS configs reject Uint8Array<ArrayBufferLike> directly).
  const buf = new Uint8Array(zipped).buffer
  const blob = new Blob([buf], { type: 'application/zip' })
  triggerDownload(blob, filename.endsWith('.zip') ? filename : `${filename}.zip`)
}

interface StreamZipEntry {
  name: string
  fetch: () => Promise<Response>
}

/**
 * Stream a ZIP to disk via client-zip. Uses File System Access API when
 * available (Chromium/Edge) — bytes pipe straight to disk, never aggregate
 * in RAM. Falls back to a buffered Blob download on Firefox/Safari.
 */
export async function streamZipDownload(entries: StreamZipEntry[], filename: string): Promise<void> {
  const safeName = filename.endsWith('.zip') ? filename : `${filename}.zip`
  const responses = await Promise.all(entries.map(async e => {
    const r = await e.fetch()
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${e.name}`)
    return { name: e.name, input: r }
  }))
  const stream = clientStreamingZip(responses).body
  if (!stream) throw new Error('client-zip returned no stream')

  if ('showSaveFilePicker' in window) {
    const handle = await (window as unknown as {
      showSaveFilePicker: (opts: { suggestedName: string; types: unknown[] }) => Promise<FileSystemFileHandle>
    }).showSaveFilePicker({
      suggestedName: safeName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    })
    const writable = await handle.createWritable()
    await stream.pipeTo(writable)
    return
  }

  // Fallback: buffer the whole stream into a Blob, then trigger anchor download.
  const blob = await new Response(stream).blob()
  triggerDownload(blob, safeName)
}

/**
 * Convert data rows to GeoJSON FeatureCollection
 */
export function toGeoJSON<T extends Record<string, unknown>>(
  data: T[],
  options?: {
    latColumn?: string
    lngColumn?: string
    geometryKey?: string
  }
): GeoJSON.FeatureCollection {
  const firstRow = data[0]
  const latKeys = ['lat', 'latitude', 'y', 'lat_dd', 'latitude_dd']
  const lngKeys = ['lng', 'lon', 'longitude', 'x', 'long_dd', 'longitude_dd']
  const latCol = options?.latColumn ?? (firstRow && Object.keys(firstRow).find(k => latKeys.includes(k.toLowerCase())))
  const lngCol = options?.lngColumn ?? (firstRow && Object.keys(firstRow).find(k => lngKeys.includes(k.toLowerCase())))
  const geomKey = options?.geometryKey ?? 'geometry'

  const features = data.map((row, index): GeoJSON.Feature => {
    // Filter out internal fields from properties
    const properties = Object.fromEntries(
      Object.entries(row).filter(([k]) => !k.startsWith('_') && k !== geomKey && k !== 'geometry')
    )

    // Determine geometry: geometry key > _geometry > lat/lng columns > null
    let geometry: GeoJSON.Geometry | null = null
    if (row[geomKey] && typeof row[geomKey] === 'object') {
      geometry = row[geomKey] as GeoJSON.Geometry
    } else if (row._geometry && typeof row._geometry === 'object') {
      geometry = row._geometry as GeoJSON.Geometry
    } else if (latCol && lngCol) {
      const lat = Number(row[latCol]), lng = Number(row[lngCol])
      if (!isNaN(lat) && !isNaN(lng)) {
        geometry = { type: 'Point', coordinates: [lng, lat] }
      }
    }

    const id = row.ogc_fid ?? row._featureId ?? row.id ?? index
    return {
      type: 'Feature',
      id: typeof id === 'string' || typeof id === 'number' ? id : index,
      geometry: geometry as GeoJSON.Geometry,
      properties,
    }
  })

  return { type: 'FeatureCollection', features }
}

/**
 * Download data as GeoJSON file
 */
export function downloadGeoJSON<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  options?: {
    latColumn?: string
    lngColumn?: string
    geometryKey?: string
  }
) {
  const geojson = toGeoJSON(data, options)
  const json = JSON.stringify(geojson, null, 2)

  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.geojson') ? filename : `${filename}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}

