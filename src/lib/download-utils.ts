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
