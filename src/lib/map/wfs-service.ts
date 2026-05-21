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
  geometryField: string
  /** First non-geometry attribute, used as sortBy for paginated WFS requests */
  sortField: string | null
  timestamp: number
}

const featureTypeCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Detect geometry field + a sortable attribute via DescribeFeatureType.
 * GeoServer requires sortBy when paginating tables/views without a PK.
 */
async function describeFeatureType(wfsUrl: string, typeName: string): Promise<{ geometryField: string; sortField: string | null }> {
  const cacheKey = `${wfsUrl}:${typeName}`
  const now = Date.now()

  const cached = featureTypeCache.get(cacheKey)
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return { geometryField: cached.geometryField, sortField: cached.sortField }
  }

  let geometryField = 'shape'
  let sortField: string | null = null

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
      const props = data.featureTypes?.[0]?.properties || []

      for (const prop of props) {
        const isGeom = prop.type?.startsWith('gml:') && geometryTypes.includes(prop.localType)
        if (isGeom && geometryField === 'shape') {
          geometryField = prop.name
        } else if (!isGeom && !sortField && prop.name) {
          sortField = prop.name
        }
        if (geometryField !== 'shape' && sortField) break
      }
    }
  } catch (err) {
    console.warn('[WFS] DescribeFeatureType failed:', err)
  }

  featureTypeCache.set(cacheKey, { geometryField, sortField, timestamp: now })
  return { geometryField, sortField }
}


/**
 * Convert GeoJSON Polygon to WKT with SRID prefix.
 * CQL INTERSECTS evaluates in the layer's native CRS, so we must declare
 * our polygon's CRS explicitly. Without this, layers stored in EPSG:3857
 * silently return 0 results when queried with EPSG:4326 coordinates.
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
  /** Sort attribute (required for stable startIndex pagination on GeoServer tables w/o PK) */
  sortBy?: string
}

/**
 * Build WFS GetFeature URL with spatial filter
 * Uses BBOX parameter for bounds queries (proper CRS handling across all layers)
 * Uses CQL INTERSECTS for polygon queries (spatial filter drawing)
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
    sortBy,
  } = options

  const url = new URL(wfsUrl)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '1.1.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', typeName)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', crs)

  const isPolygon = 'type' in spatialFilter

  if (isPolygon) {
    // Polygon: use CQL INTERSECTS for arbitrary geometry
    const wkt = polygonToWkt(spatialFilter)
    const spatialCql = `INTERSECTS(${geometryField}, ${wkt})`
    const cqlFilter = attributeFilter
      ? `${spatialCql} AND (${attributeFilter})`
      : spatialCql
    url.searchParams.set('CQL_FILTER', cqlFilter)
  } else {
    // Bounds: use BBOX parameter — GeoServer handles CRS reprojection natively,
    // avoiding SRID mismatch errors for layers with non-4326 native CRS
    const { sw, ne } = spatialFilter
    if (attributeFilter) {
      // Combine spatial + attribute into single CQL_FILTER to avoid BBOX/CQL param conflict
      const spatialCql = `BBOX(${geometryField},${sw.lng},${sw.lat},${ne.lng},${ne.lat},'EPSG:4326')`
      url.searchParams.set('CQL_FILTER', `${spatialCql} AND (${attributeFilter})`)
    } else {
      url.searchParams.set('BBOX', `${sw.lng},${sw.lat},${ne.lng},${ne.lat},EPSG:4326`)
    }
  }

  // WFS 1.1.0 uses maxFeatures instead of count
  if (count) url.searchParams.set('maxFeatures', String(count))
  if (startIndex) url.searchParams.set('startIndex', String(startIndex))
  if (sortBy) url.searchParams.set('sortBy', `${sortBy} A`)

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

// Pagination defaults — also surface to callers that want to tune.
export const DEFAULT_WFS_PAGE_SIZE = 50
export const DEFAULT_WFS_MAX_FEATURES = 10000
const CLICK_PAGE_SIZE = 50
const POLYGON_PAGE_SIZE = 1000

/**
 * Query WFS with optional pagination
 */
export interface QueryOptions {
  /** Enable pagination for large result sets */
  paginate?: boolean
  /** Page size */
  pageSize?: number
  /** Max total features */
  maxFeatures?: number
}

export interface WfsQueryResult {
  features: Feature[]
  /** True when paginated query stopped at maxFeatures with more available */
  truncated: boolean
}

export async function queryWfs(
  options: WfsQueryOptions,
  queryOptions: QueryOptions = {}
): Promise<WfsQueryResult> {
  const { paginate = false, pageSize = DEFAULT_WFS_PAGE_SIZE, maxFeatures = DEFAULT_WFS_MAX_FEATURES } = queryOptions

  if (!paginate) {
    const features = await fetchWfsPage({ ...options, count: options.count || pageSize })
    return { features, truncated: false }
  }

  const allFeatures: Feature[] = []
  let startIndex = 0
  let truncated = false

  while (allFeatures.length < maxFeatures) {
    const features = await fetchWfsPage({
      ...options,
      count: pageSize,
      startIndex,
    })

    allFeatures.push(...features)

    if (features.length < pageSize) break
    startIndex += pageSize

    if (allFeatures.length >= maxFeatures) {
      // Hit cap; last page was full so likely more available server-side
      truncated = true
      break
    }
  }

  return { features: allFeatures.slice(0, maxFeatures), truncated }
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
  /** CQL filters keyed by layer title, applied to narrow query results */
  layerFilters?: Record<string, string>
}

export interface BoxSelectQueryParams {
  visibleLayers: WMSLayerProps[]
  mapInstance: maplibregl.Map
  containerRect: DOMRect
  boxSize: number
  pageSize: number
  /** Base WMS URL - used to derive WFS endpoint */
  wmsUrl: string
  /** CQL filters keyed by layer title */
  layerFilters?: Record<string, string>
}

export interface VisibleLayersResult {
  features: WfsFeature[]
  /** True if any layer hit its maxFeatures cap */
  truncated: boolean
}

/**
 * Query visible layers within bounds, returning simplified features
 * Uses parallel individual queries with INTERSECTS for accuracy
 */
async function queryVisibleLayers(
  visibleLayers: WMSLayerProps[],
  spatialFilter: Bounds | Polygon,
  wmsUrl: string,
  options: QueryOptions = {},
  layerFilters?: Record<string, string>
): Promise<VisibleLayersResult> {
  const queries: Array<{ typeName: string; layerTitle: string; wfsUrl: string; attributeFilter?: string }> = []
  for (const layer of visibleLayers) {
    const layerWfsUrl = (layer.url || wmsUrl).replace(/\/wms\/?$/, '/wfs')
    const dynamicFilter = layerFilters?.[layer.title]
    const staticFilter = layer.customLayerParameters?.cql_filter
    const cqlFilter = dynamicFilter && staticFilter
      ? `(${dynamicFilter}) AND (${staticFilter})`
      : dynamicFilter || staticFilter
    for (const sublayer of layer.sublayers || []) {
      if (sublayer.queryable === false) continue
      const typeName = sublayer.name || ''
      if (!typeName) continue
      queries.push({ typeName, layerTitle: layer.title, wfsUrl: layerWfsUrl, attributeFilter: cqlFilter })
    }
  }

  if (queries.length === 0) return { features: [], truncated: false }

  const results = await Promise.all(
    queries.map(async ({ typeName, layerTitle, wfsUrl: layerWfsUrl, attributeFilter }) => {
      try {
        const { geometryField, sortField } = await describeFeatureType(layerWfsUrl, typeName)
        const { features, truncated } = await queryWfs({
          wfsUrl: layerWfsUrl,
          typeName,
          geometryField,
          spatialFilter,
          attributeFilter,
          sortBy: options.paginate ? (sortField ?? undefined) : undefined,
        }, options)

        return {
          features: features.map(f => ({
            id: f.id || f.properties?.ogc_fid || 0,
            properties: (f.properties || {}) as Record<string, unknown>,
            geometry: f.geometry,
            layerTitle,
          })),
          truncated,
        }
      } catch (err) {
        console.warn(`[WFS] Failed to query layer ${typeName}:`, err)
        return { features: [] as WfsFeature[], truncated: false }
      }
    })
  )

  return {
    features: results.flatMap(r => r.features),
    truncated: results.some(r => r.truncated),
  }
}

/**
 * Query features at a click point with tolerance.
 * Uses CQL INTERSECTS instead of BBOX to match against actual geometry
 * rather than bounding boxes.
 */
export async function queryWFSFeatures(params: ClickQueryParams): Promise<WfsFeature[]> {
  const { point, visibleLayers, tolerance, mapInstance, wmsUrl, layerFilters } = params

  const sw = mapInstance.unproject([point.x - tolerance, point.y + tolerance])
  const ne = mapInstance.unproject([point.x + tolerance, point.y - tolerance])
  const clickPolygon: Polygon = {
    type: 'Polygon',
    coordinates: [[
      [sw.lng, sw.lat],
      [ne.lng, sw.lat],
      [ne.lng, ne.lat],
      [sw.lng, ne.lat],
      [sw.lng, sw.lat],
    ]],
  }

  const { features } = await queryVisibleLayers(visibleLayers, clickPolygon, wmsUrl, { pageSize: CLICK_PAGE_SIZE }, layerFilters)
  return features
}

/**
 * Query features in box select area with pagination
 */
export async function queryBoxSelectFeatures(params: BoxSelectQueryParams): Promise<VisibleLayersResult> {
  const { visibleLayers, mapInstance, containerRect, boxSize, pageSize, wmsUrl, layerFilters } = params

  const centerX = containerRect.width / 2
  const centerY = containerRect.height / 2
  const halfBox = boxSize / 2

  const bounds: Bounds = {
    sw: mapInstance.unproject([centerX - halfBox, centerY + halfBox]),
    ne: mapInstance.unproject([centerX + halfBox, centerY - halfBox]),
  }

  return queryVisibleLayers(visibleLayers, bounds, wmsUrl, { paginate: true, pageSize }, layerFilters)
}

/**
 * Query features within a polygon (from spatial filter/draw)
 */
export interface PolygonQueryParams {
  polygon: Polygon
  visibleLayers: WMSLayerProps[]
  wmsUrl: string
  pageSize?: number
  /** CQL filters keyed by layer title */
  layerFilters?: Record<string, string>
}

export async function queryPolygonFeatures(params: PolygonQueryParams): Promise<VisibleLayersResult> {
  const { polygon, visibleLayers, wmsUrl, pageSize = POLYGON_PAGE_SIZE, layerFilters } = params
  return queryVisibleLayers(visibleLayers, polygon, wmsUrl, { paginate: true, pageSize }, layerFilters)
}

/**
 * Attribute-only WFS GetFeature for a specific set of ogc_fid values. Used by
 * the summary route to rehydrate a selection from URL refs without going
 * through the spatial query path. Single round trip per layer; deduped by
 * TanStack at the caller level.
 *
 * Returns the raw {@link Feature} list (geometry + properties) — the caller
 * is responsible for wrapping into LayerContentProps with the right config.
 */
export async function fetchFeaturesByOgcFids(
  wfsUrl: string,
  typeName: string,
  ogcFids: ReadonlyArray<string | number>,
  opts: { crs?: string } = {},
): Promise<Feature[]> {
  if (ogcFids.length === 0) return []
  const { crs = 'EPSG:4326' } = opts
  const url = new URL(wfsUrl)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeNames', typeName)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', crs)
  url.searchParams.set('CQL_FILTER', `ogc_fid IN (${ogcFids.map(id => Number(id)).filter(n => Number.isFinite(n)).join(',')})`)
  const response = await fetch(url.toString())
  if (!response.ok) {
    const text = await response.text()
    console.error(`[WFS] fetchFeaturesByOgcFids failed for ${typeName}: ${response.status}`, text.slice(0, 500))
    return []
  }
  try {
    const data = await response.json() as { features?: Feature[] }
    return data.features ?? []
  } catch (err) {
    console.error(`[WFS] Invalid JSON from fetchFeaturesByOgcFids for ${typeName}:`, err)
    return []
  }
}
