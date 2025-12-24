/**
 * Download data as CSV file
 */
export function downloadCSV<T>(
  data: T[],
  filename: string,
  headers: string[],
  getValue: (row: T, key: string) => unknown
) {
  const csv = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = getValue(row, h)
          if (val == null) return ''
          const str = String(val)
          // Escape quotes and wrap in quotes if contains comma/quote/newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
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

/**
 * Download entire layer via WFS as GeoJSON with pagination
 * @param wmsUrl - The WMS base URL (will be converted to WFS)
 * @param layerName - Full layer name including workspace (e.g., "hazards:quaternaryfaults_current")
 * @param title - Layer title for filename
 * @param onProgress - Optional callback for progress updates (0-100)
 * @param maxFeatures - Maximum features to fetch (default 10000, for browser performance)
 * @returns Promise that resolves when download completes or rejects on error
 */
export async function downloadLayerAsGeoJSON(
  wmsUrl: string,
  layerName: string,
  title: string,
  onProgress?: (percent: number, fetched: number, total: number | null) => void,
  maxFeatures = 10000
): Promise<void> {
  // Convert WMS URL to WFS URL
  const wfsUrl = wmsUrl.replace(/\/wms\/?$/, '/wfs')

  const pageSize = 5000
  let startIndex = 0
  let totalMatched: number | null = null
  const allFeatures: GeoJSON.Feature[] = []

  // Fetch pages until we have all features or hit the limit
  while (true) {
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: layerName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      startIndex: String(startIndex),
      count: String(pageSize),
    })

    const requestUrl = `${wfsUrl}?${params.toString()}`
    const response = await fetch(requestUrl)

    if (!response.ok) {
      throw new Error(`WFS request failed: ${response.status} ${response.statusText}`)
    }

    const batch = await response.json() as GeoJSON.FeatureCollection & {
      numberMatched?: number
      numberReturned?: number
    }

    // Get total count from first response
    if (totalMatched === null && batch.numberMatched !== undefined) {
      totalMatched = batch.numberMatched
    }

    allFeatures.push(...batch.features)

    // Report progress
    if (onProgress) {
      const percent = totalMatched
        ? Math.min(100, Math.round((allFeatures.length / totalMatched) * 100))
        : null
      onProgress(percent ?? 0, allFeatures.length, totalMatched)
    }

    // Check if we're done
    const returnedCount = batch.numberReturned ?? batch.features.length
    if (returnedCount < pageSize) {
      // Last page - no more features
      break
    }

    if (allFeatures.length >= maxFeatures) {
      console.warn(`Layer export capped at ${maxFeatures} features for browser performance`)
      break
    }

    startIndex += pageSize
  }

  // Build final GeoJSON
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: allFeatures,
  }

  // Download the GeoJSON
  const json = JSON.stringify(geojson, null, 2)
  const blob = new Blob([json], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Sanitize title for filename
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  a.download = `${safeTitle}.geojson`
  a.click()
  URL.revokeObjectURL(url)
}
