/**
 * Unified WFS query service
 * All spatial queries use CQL INTERSECTS for accurate geometry matching
 */
import type { Geometry, Feature, Polygon } from 'geojson'
import type { WMSLayerProps } from '@/lib/types/mapping-types'

export interface WfsFeature {
  id: string | number
  properties: Record<string, unknown>
  geometry?: Geometry
  layerTitle?: string
}

type Bounds = {
  sw: { lng: number; lat: number }
  ne: { lng: number; lat: number }
}

// =============================================================================
// Geometry field detection (cached)
// =============================================================================

interface CacheEntry {
  field: string
  timestamp: number
}

const geometryFieldCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Detect the geometry field name for a layer via DescribeFeatureType
 */
async function getGeometryField(wfsUrl: string, typeName: string): Promise<string> {
  const cacheKey = `${wfsUrl}:${typeName}`
  const now = Date.now()

  // Check cache
  const cached = geometryFieldCache.get(cacheKey)
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.field
  }

  try {
    const url = new URL(wfsUrl)
    url.searchParams.set('service', 'WFS')
    url.searchParams.set('version', '2.0.0')
    url.searchParams.set('request', 'DescribeFeatureType')
    url.searchParams.set('typeName', typeName)
    url.searchParams.set('outputFormat', 'application/json')

    const response = await fetch(url.toString())
    if (response.ok) {
      const data = await response.json()
      const geometryTypes = ['MultiPolygon', 'Polygon', 'MultiLineString', 'LineString', 'Point', 'MultiPoint', 'Geometry']

      if (data.featureTypes?.[0]?.properties) {
        for (const prop of data.featureTypes[0].properties) {
          if (prop.type?.startsWith('gml:') && geometryTypes.includes(prop.localType)) {
            geometryFieldCache.set(cacheKey, { field: prop.name, timestamp: now })
            return prop.name
          }
        }
      }
    }
  } catch (err) {
    console.warn('[WFS] Failed to detect geometry field:', err)
  }

  // Fallback to 'shape'
  geometryFieldCache.set(cacheKey, { field: 'shape', timestamp: now })
  return 'shape'
}

/**
 * Convert bounds to WKT POLYGON with SRID
 */
function boundsToWkt(bounds: Bounds): string {
  const { sw, ne } = bounds
  return `SRID=4326;POLYGON((${sw.lng} ${sw.lat}, ${ne.lng} ${sw.lat}, ${ne.lng} ${ne.lat}, ${sw.lng} ${ne.lat}, ${sw.lng} ${sw.lat}))`
}

/**
 * Convert GeoJSON Polygon to WKT with SRID
 */
function polygonToWkt(polygon: Polygon): string {
  const ring = polygon.coordinates[0]
  const coords = ring.map(([lng, lat]) => `${lng} ${lat}`).join(', ')
  return `SRID=4326;POLYGON((${coords}))`
}

/**
 * Query options for WFS service
 */
export interface WfsQueryOptions {
  /** WFS base URL */
  wfsUrl: string
  /** Layer type name (e.g., "hazards:faults_current") */
  typeName: string
  /** Geometry field name for INTERSECTS (default: 'shape') */
  geometryField?: string
  /** Spatial filter - bounds box or polygon */
  spatialFilter: Bounds | Polygon
  /** Additional CQL attribute filter */
  attributeFilter?: string
  /** Coordinate reference system (default: EPSG:4326) */
  crs?: string
  /** Max features per request */
  count?: number
  /** Starting index for pagination */
  startIndex?: number
}

/**
 * Build WFS GetFeature URL with BBOX filter
 */
function buildWfsUrl(options: WfsQueryOptions): string {
  const {
    wfsUrl,
    typeName,
    geometryField = 'shape',
    spatialFilter,
    attributeFilter,
    crs = 'EPSG:4326',
    count,
    startIndex,
  } = options

  const url = new URL(wfsUrl)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '1.1.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', typeName)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', crs)

  // Use CQL INTERSECTS for all spatial queries
  const wkt = 'type' in spatialFilter && spatialFilter.type === 'Polygon'
    ? polygonToWkt(spatialFilter as Polygon)
    : boundsToWkt(spatialFilter as Bounds)

  const spatialCql = `INTERSECTS(${geometryField}, ${wkt})`
  const cqlFilter = attributeFilter
    ? `${spatialCql} AND ${attributeFilter}`
    : spatialCql
  url.searchParams.set('CQL_FILTER', cqlFilter)

  // WFS 1.1.0 uses maxFeatures instead of count
  if (count) url.searchParams.set('maxFeatures', String(count))
  if (startIndex) url.searchParams.set('startIndex', String(startIndex))

  return url.toString()
}

/**
 * Fetch features from a single WFS request
 */
async function fetchWfsPage(options: WfsQueryOptions): Promise<Feature[]> {
  const url = buildWfsUrl(options)
  const response = await fetch(url)

  if (!response.ok) {
    const text = await response.text()
    console.error(`[WFS] Request failed for ${options.typeName}: ${response.status}`, text.slice(0, 500))
    return []
  }

  const text = await response.text()
  try {
    const data = JSON.parse(text)
    return data.features || []
  } catch {
    // GeoServer returned non-JSON (likely XML error)
    console.error(`[WFS] Invalid JSON response for ${options.typeName}:`, text.slice(0, 500))
    return []
  }
}

/**
 * Query WFS with optional pagination
 */
export interface QueryOptions {
  /** Enable pagination for large result sets */
  paginate?: boolean
  /** Page size (default: 50) */
  pageSize?: number
  /** Max total features (default: 10000) */
  maxFeatures?: number
}

export async function queryWfs(
  options: WfsQueryOptions,
  queryOptions: QueryOptions = {}
): Promise<Feature[]> {
  const { paginate = false, pageSize = 50, maxFeatures = 10000 } = queryOptions

  if (!paginate) {
    return fetchWfsPage({ ...options, count: options.count || pageSize })
  }

  // Paginated query
  const allFeatures: Feature[] = []
  let startIndex = 0

  while (allFeatures.length < maxFeatures) {
    const features = await fetchWfsPage({
      ...options,
      count: pageSize,
      startIndex,
    })

    allFeatures.push(...features)

    if (features.length < pageSize) break
    startIndex += pageSize
  }

  return allFeatures
}

// =============================================================================
// High-level query functions for map interactions
// =============================================================================

export interface ClickQueryParams {
  point: { x: number; y: number }
  visibleLayers: WMSLayerProps[]
  tolerance: number
  mapInstance: maplibregl.Map
  /** Base WMS URL - used to derive WFS endpoint */
  wmsUrl: string
}

export interface BoxSelectQueryParams {
  visibleLayers: WMSLayerProps[]
  mapInstance: maplibregl.Map
  containerRect: DOMRect
  boxSize: number
  pageSize: number
  /** Base WMS URL - used to derive WFS endpoint */
  wmsUrl: string
}

/**
 * Query visible layers within bounds, returning simplified features
 * Uses parallel individual queries with INTERSECTS for accuracy
 */
async function queryVisibleLayers(
  visibleLayers: WMSLayerProps[],
  spatialFilter: Bounds | Polygon,
  wmsUrl: string,
  options: QueryOptions = {}
): Promise<WfsFeature[]> {
  // Build WFS URL from WMS URL (just replace /wms with /wfs)
  const wfsUrl = wmsUrl.replace(/\/wms\/?$/, '/wfs')

  // Build list of all sublayers to query
  const queries: Array<{ typeName: string; layerTitle: string }> = []
  for (const layer of visibleLayers) {
    for (const sublayer of layer.sublayers || []) {
      if (sublayer.queryable === false) continue
      const typeName = sublayer.name || ''
      if (!typeName) continue
      queries.push({ typeName, layerTitle: layer.title })
    }
  }

  if (queries.length === 0) return []

  // Query all layers in parallel
  const results = await Promise.all(
    queries.map(async ({ typeName, layerTitle }) => {
      try {
        const geometryField = await getGeometryField(wfsUrl, typeName)
        console.log(`[WFS] Layer ${typeName} using geometry field: ${geometryField}`)
        const features = await queryWfs({
          wfsUrl,
          typeName,
          geometryField,
          spatialFilter,
        }, options)

        return features.map(f => ({
          id: f.id || f.properties?.ogc_fid || 0,
          properties: (f.properties || {}) as Record<string, unknown>,
          geometry: f.geometry,
          layerTitle,
        }))
      } catch (err) {
        console.warn(`[WFS] Failed to query layer ${typeName}:`, err)
        return []
      }
    })
  )

  return results.flat()
}

/**
 * Query features at a click point with tolerance
 */
export async function queryWFSFeatures(params: ClickQueryParams): Promise<WfsFeature[]> {
  const { point, visibleLayers, tolerance, mapInstance, wmsUrl } = params

  const bounds: Bounds = {
    sw: mapInstance.unproject([point.x - tolerance, point.y + tolerance]),
    ne: mapInstance.unproject([point.x + tolerance, point.y - tolerance]),
  }

  return queryVisibleLayers(visibleLayers, bounds, wmsUrl, { pageSize: 50 })
}

/**
 * Query features in box select area with pagination
 */
export async function queryBoxSelectFeatures(params: BoxSelectQueryParams): Promise<WfsFeature[]> {
  const { visibleLayers, mapInstance, containerRect, boxSize, pageSize, wmsUrl } = params

  const centerX = containerRect.width / 2
  const centerY = containerRect.height / 2
  const halfBox = boxSize / 2

  const bounds: Bounds = {
    sw: mapInstance.unproject([centerX - halfBox, centerY + halfBox]),
    ne: mapInstance.unproject([centerX + halfBox, centerY - halfBox]),
  }

  return queryVisibleLayers(visibleLayers, bounds, wmsUrl, { paginate: true, pageSize })
}

/**
 * Query features within a polygon (from spatial filter/draw)
 */
export interface PolygonQueryParams {
  polygon: Polygon
  visibleLayers: WMSLayerProps[]
  wmsUrl: string
  pageSize?: number
}

export async function queryPolygonFeatures(params: PolygonQueryParams): Promise<WfsFeature[]> {
  const { polygon, visibleLayers, wmsUrl, pageSize = 100 } = params
  return queryVisibleLayers(visibleLayers, polygon, wmsUrl, { paginate: true, pageSize })
}
