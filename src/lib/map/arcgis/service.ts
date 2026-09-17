/**
 * ArcGIS REST services — URL shapes, service metadata, and feature reads.
 *
 * Two kinds of endpoint matter:
 * - a **service** (`.../MapServer`, `.../FeatureServer`), which is a container
 *   of layers. MapServer can also draw itself as one image, which is how the
 *   app's configured Esri layers render.
 * - a **layer** (`.../MapServer/3`, `.../FeatureServer/0`), which has fields and
 *   features and can be queried as GeoJSON — that is what gives us a real vector
 *   layer with a popup instead of a picture of one.
 *
 * Everything here is parsed defensively: these are third-party servers and the
 * JSON shape varies by version, so responses are narrowed at runtime rather than
 * asserted.
 */
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import { isRecord } from '@/lib/utils'

/** `.../MapServer`, `.../FeatureServer`, optionally followed by a layer index. */
const SERVICE_RE = /\/(FeatureServer|MapServer)(?:\/(\d+))?\/?$/i

export type ArcGisServiceKind = 'MapServer' | 'FeatureServer'

/** An ArcGIS REST URL, split into the parts the rest of this module needs. */
export interface ArcGisUrlParts {
    /** Service root, no trailing slash and no layer index. */
    serviceUrl: string
    kind: ArcGisServiceKind
    /** Layer index when the URL pointed at one layer, else undefined. */
    layerId?: number
}

/** Recognize an ArcGIS REST endpoint, ignoring any query string. */
export function parseArcGisUrl(raw: string): ArcGisUrlParts | null {
    const [path] = raw.split('?')
    const match = SERVICE_RE.exec(path)
    if (!match) return null
    const kind = match[1].toLowerCase() === 'featureserver' ? 'FeatureServer' : 'MapServer'
    const serviceUrl = path.slice(0, match.index + match[1].length + 1)
    return {
        serviceUrl: serviceUrl.replace(/\/$/, ''),
        kind,
        layerId: match[2] === undefined ? undefined : Number(match[2]),
    }
}

/** Fetch JSON from an ArcGIS endpoint, surfacing the server's own error text. */
async function fetchArcGisJson(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const target = new URL(url)
    for (const [k, v] of Object.entries({ f: 'json', ...params })) target.searchParams.set(k, v)

    const res = await fetch(target.toString())
    if (!res.ok) throw new Error(`ArcGIS request failed (${res.status} ${res.statusText})`)
    const body: unknown = await res.json()
    if (!isRecord(body)) throw new Error('ArcGIS returned an unexpected response.')
    // ArcGIS reports failures as HTTP 200 with an `error` member.
    if (isRecord(body.error)) {
        const message = typeof body.error.message === 'string' ? body.error.message : 'unknown error'
        throw new Error(`ArcGIS error: ${message}`)
    }
    return body
}

/** One layer advertised by a service. */
export interface ArcGisLayerSummary {
    id: number
    name: string
}

/** What a service or layer endpoint tells us about itself. */
export interface ArcGisServiceInfo {
    /** Service or layer name, for the layer title. */
    name: string
    /** Layers the service advertises. Empty when the URL named a single layer. */
    layers: ArcGisLayerSummary[]
    /** True when the endpoint is a single queryable layer. */
    isLayer: boolean
    /** Whether the layer/service can answer `query` requests. */
    queryable: boolean
}

function layerSummaries(value: unknown): ArcGisLayerSummary[] {
    if (!Array.isArray(value)) return []
    const out: ArcGisLayerSummary[] = []
    for (const entry of value) {
        if (!isRecord(entry)) continue
        const id = typeof entry.id === 'number' ? entry.id : undefined
        if (id === undefined) continue
        // A group layer has sublayers of its own and cannot be queried directly.
        if (Array.isArray(entry.subLayerIds) && entry.subLayerIds.length > 0) continue
        out.push({ id, name: typeof entry.name === 'string' ? entry.name : `Layer ${id}` })
    }
    return out
}

/** Read a service's (or layer's) metadata. */
export async function fetchArcGisInfo(parts: ArcGisUrlParts): Promise<ArcGisServiceInfo> {
    const url = parts.layerId === undefined ? parts.serviceUrl : `${parts.serviceUrl}/${parts.layerId}`
    const body = await fetchArcGisJson(url, {})

    const isLayer = parts.layerId !== undefined
    const name = typeof body.name === 'string' && body.name
        ? body.name
        : typeof body.mapName === 'string' && body.mapName
            ? body.mapName
            : typeof body.serviceDescription === 'string' && body.serviceDescription
                ? body.serviceDescription
                : 'ArcGIS layer'

    // `capabilities` is a comma-separated string on both services and layers.
    const capabilities = typeof body.capabilities === 'string' ? body.capabilities.toLowerCase() : ''
    return {
        name,
        layers: isLayer ? [] : layerSummaries(body.layers),
        isLayer,
        queryable: capabilities.includes('query'),
    }
}

/** Features ArcGIS returns per page. Servers cap this themselves (often 1000–2000). */
const PAGE_SIZE = 1000

/** Hard stop, so a careless click on a national dataset cannot hang the tab. */
export const ARCGIS_FEATURE_CAP = 20000

const GEOMETRY_TYPES = new Set([
    'Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection',
])

/** Checked narrowing for a GeoJSON geometry. */
function isGeometry(value: unknown): value is Geometry {
    if (!isRecord(value) || typeof value.type !== 'string' || !GEOMETRY_TYPES.has(value.type)) return false
    return value.type === 'GeometryCollection' ? Array.isArray(value.geometries) : Array.isArray(value.coordinates)
}

function featuresOf(value: unknown): Feature[] {
    if (!isRecord(value) || !Array.isArray(value.features)) return []
    const out: Feature[] = []
    for (const entry of value.features) {
        if (!isRecord(entry)) continue
        if (entry.type !== 'Feature') continue
        // A layer can hold rows with no geometry; nothing can draw those.
        if (!isGeometry(entry.geometry)) continue
        out.push({
            type: 'Feature',
            geometry: entry.geometry,
            properties: isRecord(entry.properties) ? entry.properties : {},
            ...(typeof entry.id === 'string' || typeof entry.id === 'number' ? { id: entry.id } : {}),
        })
    }
    return out
}

/** Thrown when a layer holds more than {@link ARCGIS_FEATURE_CAP} features. */
export class ArcGisTooManyFeaturesError extends Error {
    constructor(public readonly count: number) {
        super(`This ArcGIS layer has more than ${ARCGIS_FEATURE_CAP.toLocaleString()} features.`)
        this.name = 'ArcGisTooManyFeaturesError'
    }
}

/** Row count for a layer, which ArcGIS answers from metadata. */
export async function fetchArcGisCount(layerUrl: string): Promise<number> {
    const body = await fetchArcGisJson(`${layerUrl}/query`, { where: '1=1', returnCountOnly: 'true' })
    return typeof body.count === 'number' ? body.count : 0
}

/**
 * Read every feature of one layer as GeoJSON.
 *
 * ArcGIS caps a response at its own `maxRecordCount` and sets
 * `exceededTransferLimit`, so this pages with `resultOffset` until a short page
 * comes back. `outSR=4326` because MapLibre works in lon/lat and the service's
 * native projection is often Web Mercator or a state plane.
 */
export async function fetchArcGisGeoJSON(
    layerUrl: string,
    opts: { cap?: number; signal?: AbortSignal } = {},
): Promise<FeatureCollection> {
    const cap = opts.cap ?? ARCGIS_FEATURE_CAP
    const features: Feature[] = []

    for (let offset = 0; offset < cap; offset += PAGE_SIZE) {
        const body = await fetchArcGisJson(`${layerUrl}/query`, {
            f: 'geojson',
            where: '1=1',
            outFields: '*',
            outSR: '4326',
            returnGeometry: 'true',
            resultOffset: String(offset),
            resultRecordCount: String(PAGE_SIZE),
        })
        const page = featuresOf(body)
        features.push(...page)
        // A short page means the server has nothing left to give.
        if (page.length < PAGE_SIZE) break
    }

    return { type: 'FeatureCollection', features }
}
