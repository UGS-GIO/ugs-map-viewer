/**
 * Detect a geospatial format from a URL or uploaded file and build the matching
 * runtime `LayerProps` for the user "add layer" flow.
 *
 * Supported: PMTiles, GeoJSON (URL or upload), WMS, COG, and STAC items
 * (by id against the serving-topics collection, or by direct item URL). STAC
 * items reuse the existing resolver so a user-added STAC layer gets the same
 * data + symbology wiring as a config-authored one.
 */
import { PMTiles } from 'pmtiles'
import type { FeatureCollection } from 'geojson'
import type {
    COGLayerProps,
    GeoJSONLayerProps,
    LayerProps,
    PMTilesLayerProps,
    WMSLayerProps,
    ParquetLayerProps,
} from '@/lib/types/mapping-types'
import {
    STAC_SERVING_TOPICS_ITEMS_URL,
    fetchStacItem,
    fetchStacItemIndex,
    resolveStacPMTilesLayer,
    stacItemHref,
    type StacItem,
} from '@/lib/map/stac/stac-layer'
import { loadCogMetadata } from '@/hooks/use-cog-metadata'
import { registerLocalPMTiles, unregisterLocalPMTiles } from '@/lib/map/pmtiles/setup'
import { userVectorPaint } from '@/components/maps/user-vector-layers'
import { hashString } from '@/lib/utils'
import {
    loadParquetForDeck,
    ParquetLoadCancelledError,
    LARGE_PARQUET_FEATURE_COUNT,
    type LoadParquetOptions,
} from '@/lib/map/user-layers/parquet-deck-loader'
import {
    parseArcGisUrl,
    fetchArcGisInfo,
    fetchArcGisCount,
    fetchArcGisGeoJSON,
    ArcGisTooManyFeaturesError,
    ARCGIS_FEATURE_CAP,
} from '@/lib/map/arcgis/service'

/** A layer produced by uploading a local file (data lives in the browser, not a URL). */
export type UploadedLayer = GeoJSONLayerProps | PMTilesLayerProps | COGLayerProps | ParquetLayerProps

export type DetectedFormat = 'pmtiles' | 'geojson' | 'cog' | 'wms' | 'stac' | 'parquet' | 'arcgis' | 'unknown'

/**
 * Ceiling for uploaded files. GeoJSON is parsed into memory whole, and a Parquet
 * upload is buffered into DuckDB's WASM heap, which is 32-bit and cannot hand
 * out large contiguous blocks. Both die well before the browser complains — as
 * an opaque "malloc of size N failed" — so the limit is enforced up front with
 * a message that says what to do instead.
 */
export const MAX_UPLOAD_BYTES = 256 * 1024 * 1024

function formatBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
    return `${Math.round(bytes / 1024 ** 2)} MB`
}

/** Deterministic colour from a title so a layer keeps its colour across reloads. */
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
export function colorFromTitle(title: string): string {
    return PALETTE[hashString(title) % PALETTE.length]
}

/** Default viridis-like ramp for user COG layers with no styling metadata. */
const DEFAULT_COG_STOPS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']

/** A generic MapLibre style fragment (fill+line+circle) as a `data:` URL the
 *  PMTiles engine can fetch. Lets a user PMTiles render with no STAC style.
 *  Paint comes from the same spec the GeoJSON and tiled-Parquet sources use. */
export function defaultVectorStyleUrl(sourceLayer: string, color: string): string {
    const paint = userVectorPaint(color)
    const fragment = {
        layers: [
            { id: 'user-fill', type: 'fill', 'source-layer': sourceLayer, filter: ['==', ['geometry-type'], 'Polygon'], paint: paint.fill },
            { id: 'user-line', type: 'line', 'source-layer': sourceLayer, paint: paint.line },
            { id: 'user-circle', type: 'circle', 'source-layer': sourceLayer, filter: ['==', ['geometry-type'], 'Point'], paint: paint.circle },
        ],
    }
    return 'data:application/json,' + encodeURIComponent(JSON.stringify(fragment))
}

/** Best-effort format guess from a URL alone (before any network fetch). */
export function detectFormatFromUrl(raw: string): DetectedFormat {
    const [path] = raw.split('?')
    const p = path.toLowerCase()
    const qs = raw.toLowerCase()
    if (p.endsWith('.pmtiles')) return 'pmtiles'
    if (p.endsWith('.geojson')) return 'geojson'
    if (p.endsWith('.parquet')) return 'parquet'
    if (p.endsWith('.tif') || p.endsWith('.tiff')) return 'cog'
    if (qs.includes('service=wms') || p.endsWith('/wms') || p.endsWith('/wms/')) return 'wms'
    if (parseArcGisUrl(raw)) return 'arcgis'
    if (p.endsWith('.json')) return 'stac' // could also be GeoJSON — resolved on fetch
    return 'unknown'
}

/** Derive a display title from a URL's filename. */
export function titleFromUrl(raw: string): string {
    const [path] = raw.split('?')
    const base = path.split('/').filter(Boolean).pop() || 'layer'
    return base.replace(/\.(pmtiles|geojson|json|tif|tiff|parquet)$/i, '') || 'layer'
}

async function pmtilesSourceLayer(url: string): Promise<string> {
    try {
        const meta = (await new PMTiles(url).getMetadata()) as { vector_layers?: Array<{ id: string }> }
        return meta.vector_layers?.[0]?.id ?? 'default'
    } catch (e) {
        console.warn('[user-layers] PMTiles metadata read failed; defaulting source-layer:', e)
        return 'default'
    }
}

function buildPMTiles(url: string, title: string): Promise<PMTilesLayerProps> {
    const color = colorFromTitle(title)
    return pmtilesSourceLayer(url).then(sourceLayer => ({
        type: 'pmtiles',
        title,
        pmtilesUrl: url,
        sourceLayer,
        styleUrl: defaultVectorStyleUrl(sourceLayer, color),
        visible: true,
        opacity: 0.85,
        userAdded: true,
    }))
}

function buildGeoJSONFromUrl(url: string, title: string): GeoJSONLayerProps {
    return { type: 'geojson', title, geojsonUrl: url, color: colorFromTitle(title), visible: true, opacity: 0.8, userAdded: true }
}

function buildGeoJSONFromData(data: FeatureCollection, title: string, idbKey?: string): GeoJSONLayerProps {
    return { type: 'geojson', title, data, idbKey, color: colorFromTitle(title), visible: true, opacity: 0.8, userAdded: true, local: !!idbKey }
}

/**
 * Both COG failure modes are silent — the layer mounts and simply never draws —
 * so they're caught at add-time instead:
 *
 *  - No stats: `useCogRange` can't compute a colour range and returns undefined.
 *  - Not EPSG:3857: the cog protocol assumes Web Mercator (`CogReader` runs
 *    `mercatorBboxToGeographicBbox` over the image bbox), so another CRS yields
 *    garbage bounds and the tiles land nowhere. `epsg` is only checked when it
 *    could actually be read, so an unreadable geokey never causes a false reject.
 *
 * Returns the resolved stats so callers needn't re-read them.
 */
async function assertRenderableCog(url: string, label: string, stacUrl?: string) {
    let stats
    try {
        stats = await loadCogMetadata(url, stacUrl)
    } catch {
        stats = null
    }
    if (!stats) {
        throw new Error(
            `"${label}" has no readable statistics, so its colour range can't be computed and it would render blank. ` +
            `Add stats before converting to COG (gdal_edit.py -stats src.tif, then gdal_translate -of COG).`,
        )
    }
    if (stats.epsg !== undefined && stats.epsg !== 3857) {
        throw new Error(
            `"${label}" is EPSG:${stats.epsg}, but COG layers must be EPSG:3857 (Web Mercator) to line up on the map. ` +
            `Reproject it first: gdalwarp -t_srs EPSG:3857 src.tif out.tif`,
        )
    }
    return stats
}

async function buildCOG(url: string, title: string, stacUrl?: string): Promise<COGLayerProps> {
    await assertRenderableCog(url, title, stacUrl)
    return { type: 'cog', title, cogUrl: url, stacUrl, colorStops: DEFAULT_COG_STOPS, stretchMode: 'minmax', continuous: true, visible: true, opacity: 0.9, userAdded: true }
}

/** WMS needs a layer name; parse it from a `layers=` param or take an explicit one. */
function buildWMS(url: string, title: string, layerName?: string): WMSLayerProps {
    let name = layerName
    if (!name) {
        try { name = new URL(url).searchParams.get('layers') ?? undefined } catch { /* ignore */ }
    }
    const baseUrl = url.split('?')[0]
    return {
        type: 'wms',
        title,
        url: baseUrl,
        sublayers: [{ name: name ?? title }],
        visible: true,
        opacity: 0.85,
        userAdded: true,
    }
}

/**
 * Build a layer from an ArcGIS REST URL.
 *
 * A single layer (`.../FeatureServer/0`) is read as GeoJSON so it draws as real
 * vectors and clicks give a popup. A bare `MapServer` has no one set of
 * features to fetch, so it falls back to the server's own rendered image — the
 * same path the app's configured Esri layers use. A bare `FeatureServer` takes
 * its first layer, since that is what the user almost always means.
 */
async function buildArcGis(raw: string, opts: BuildFromUrlOptions): Promise<LayerProps> {
    const parts = parseArcGisUrl(raw)
    if (!parts) throw new Error(`Not an ArcGIS REST URL: "${raw}"`)

    const info = await fetchArcGisInfo(parts)
    let layerId = parts.layerId
    let title = opts.title ?? info.name

    if (layerId === undefined && parts.kind === 'FeatureServer') {
        const first = info.layers[0]
        if (!first) throw new Error('This FeatureServer advertises no layers.')
        layerId = first.id
        if (!opts.title) title = first.name
    }

    // MapServer as a whole: the server draws it, so there is nothing to query.
    if (layerId === undefined) {
        return {
            type: 'map-image',
            title,
            url: parts.serviceUrl,
            visible: true,
            opacity: 0.85,
            userAdded: true,
        }
    }

    const layerUrl = `${parts.serviceUrl}/${layerId}`
    const count = await fetchArcGisCount(layerUrl)
    if (count > ARCGIS_FEATURE_CAP) throw new ArcGisTooManyFeaturesError(count)
    if (opts.onLargeDataset && count >= LARGE_PARQUET_FEATURE_COUNT) {
        const proceed = await opts.onLargeDataset({ name: title, featureCount: count })
        if (!proceed) throw new ParquetLoadCancelledError()
    }

    const data = await fetchArcGisGeoJSON(layerUrl)
    if (data.features.length === 0) throw new Error(`"${title}" returned no features.`)
    return buildGeoJSONFromData(data, title)
}

async function buildFromStacItem(item: StacItem, title: string, itemHref?: string): Promise<LayerProps> {
    const hasPmtiles = !!item.assets?.pmtiles
        || Object.values(item.assets ?? {}).some(a => a.type === 'application/vnd.pmtiles')
    if (hasPmtiles) {
        const layer = resolveStacPMTilesLayer(item, { stacItemId: item.id, title, visible: true })
        // If the STAC item has no authored renders (like NatCarb or unstyled warehouse items),
        // synthesize a default vector style so points, lines, and polygons render visibly.
        const hasRenders = (layer.renders && layer.renders.length > 0) || !!layer.styleUrl
        if (!hasRenders) {
            const color = colorFromTitle(title)
            const fallbackStyleUrl = defaultVectorStyleUrl(layer.sourceLayer, color)
            layer.styleUrl = fallbackStyleUrl
            layer.renders = [{ id: 'default', title: 'Default', styleUrl: fallbackStyleUrl }]
            layer.defaultRenderId = 'default'
        }
        return { ...layer, userAdded: true }
    }
    // Prefer visual Web Mercator (EPSG:3857) GeoTIFF, otherwise any GeoTIFF asset
    const cog = item.assets?.visual
        ?? Object.values(item.assets ?? {}).find(
            a => a.roles?.includes('visual') && (a.type?.includes('image/tiff') || a.href?.match(/\.(tif|tiff)$/i)),
        )
        ?? Object.values(item.assets ?? {}).find(
            a => (a.type?.includes('image/tiff') || a.type?.includes('geotiff') || a.href?.match(/\.(tif|tiff)$/i)),
        )
    // Pass the item href so the COG can fall back to the item's raster:bands stats.
    if (cog?.href) return buildCOG(cog.href, title, itemHref)
    throw new Error(`STAC item '${item.id}' has no PMTiles or COG asset to render.`)
}

/** Fetch a STAC item straight off its URL. The shared `fetchStacItem` hydrates an index
 *  entry (deriving the href from `ugs:dbt_schema`), which a user-supplied URL has no
 *  entry for — so the direct-URL path reads the document itself. */
async function fetchStacItemFromUrl(url: string): Promise<StacItem> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`STAC item fetch failed: ${res.status}`)
    return await res.json() as StacItem
}

/** Resolve a STAC item id (serving-topics collection) or a direct item URL. */
async function buildFromStac(input: string, title: string): Promise<LayerProps> {
    // Direct item URL?
    if (/^https?:\/\//i.test(input) && (input.toLowerCase().endsWith('.json') || input.toLowerCase().includes('/stac/'))) {
        const item = await fetchStacItemFromUrl(input)
        const docType = (item as unknown as { type?: string }).type
        if (docType === 'Catalog' || docType === 'Collection') {
            throw new Error(`"${input}" is a STAC ${docType}, not an individual Item. Use the STAC explorer to select a layer from it.`)
        }
        // GeoJSON masquerading as .json (no stac_version) → treat as GeoJSON.
        if (!('stac_version' in item) && docType === 'FeatureCollection') {
            return buildGeoJSONFromUrl(input, title)
        }
        return buildFromStacItem(item, title || item.id, input)
    }
    // Otherwise treat as an id in the serving-topics collection. The index holds compact
    // entries; hydrate to the full item so assets/renders are complete.
    const index = await fetchStacItemIndex()
    const entry = index[input]
    if (!entry) throw new Error(`STAC item id '${input}' not found in ${STAC_SERVING_TOPICS_ITEMS_URL}`)
    const item = await fetchStacItem(entry)
    return buildFromStacItem(item, title || item.id, stacItemHref(entry))
}

export interface BuildFromUrlOptions {
    /** Override the auto title. */
    title?: string
    /** Force a format instead of sniffing. */
    format?: DetectedFormat
    /** WMS layer name (workspace:layer) when it isn't in the URL. */
    wmsLayerName?: string
    /** Confirmation callback for large Parquet sources. Omit to load without prompting. */
    onLargeDataset?: LoadParquetOptions['onLargeDataset']
}

/** Build a runtime layer from a URL (or a bare STAC item id). Async because some
 *  formats must read remote metadata (PMTiles header, STAC item). */
export async function buildLayerFromUrl(input: string, opts: BuildFromUrlOptions = {}): Promise<LayerProps> {
    const raw = input.trim()
    if (!raw) throw new Error('Enter a URL or STAC item id.')

    const isUrl = /^https?:\/\//i.test(raw)
    // A bare token (no scheme, no dot) → STAC item id.
    if (!isUrl && !raw.includes('/') && !raw.includes('.')) {
        return buildFromStac(raw, opts.title ?? raw)
    }

    const format = opts.format ?? detectFormatFromUrl(raw)
    const title = opts.title ?? titleFromUrl(raw)

    switch (format) {
        case 'pmtiles': return buildPMTiles(raw, title)
        case 'geojson': return buildGeoJSONFromUrl(raw, title)
        case 'parquet': {
            const deckData = await loadParquetForDeck(raw, { onLargeDataset: opts.onLargeDataset, name: title })
            return {
                type: 'parquet',
                title,
                parquetUrl: raw,
                deckData,
                color: colorFromTitle(title),
                visible: true,
                opacity: 0.85,
                userAdded: true,
            }
        }
        case 'cog': return buildCOG(raw, title)
        case 'wms': return buildWMS(raw, title, opts.wmsLayerName)
        case 'arcgis': return buildArcGis(raw, opts)
        case 'stac': return buildFromStac(raw, title)
        default:
            throw new Error(`Could not detect format for "${raw}". Supported: .pmtiles, .geojson, .parquet, .tif/.tiff, WMS, ArcGIS MapServer/FeatureServer, or a STAC item id/URL.`)
    }
}

/**
 * Build a layer from a local PMTiles archive. Registers a `FileSource`-backed
 * instance with the protocol and points the layer at its key rather than a URL
 * — see {@link registerLocalPMTiles}.
 *
 * The protocol keys instances by `FileSource.getKey()`, which is the file NAME.
 * Two uploads called `tiles.pmtiles` would therefore collide and silently render
 * the same data, so the file is re-wrapped under a uuid-prefixed name and THAT
 * file is what gets persisted + registered. The display title keeps the original.
 */
export async function buildPMTilesFromFile(file: File, idbKey: string): Promise<{ def: PMTilesLayerProps; file: File }> {
    const keyedFile = new File([file], `${idbKey}-${file.name}`, { type: file.type })
    const archive = registerLocalPMTiles(keyedFile)
    let meta: { vector_layers?: Array<{ id: string }> }
    try {
        meta = (await archive.getMetadata()) as { vector_layers?: Array<{ id: string }> }
    } catch (e) {
        throw new Error(`"${file.name}" could not be read as a PMTiles archive: ${e instanceof Error ? e.message : String(e)}`)
    }
    const sourceLayer = meta.vector_layers?.[0]?.id
    if (!sourceLayer) {
        throw new Error(`"${file.name}" has no vector layers — only vector PMTiles archives can be added.`)
    }
    const title = file.name.replace(/\.pmtiles$/i, '')
    return {
        def: {
            type: 'pmtiles',
            title,
            // The protocol key, NOT a URL. `local` tells the source component to use it verbatim.
            pmtilesUrl: keyedFile.name,
            sourceLayer,
            styleUrl: defaultVectorStyleUrl(sourceLayer, colorFromTitle(title)),
            visible: true,
            opacity: 0.85,
            userAdded: true,
            local: true,
            idbKey,
        },
        file: keyedFile,
    }
}

/**
 * Build a layer from a local COG. The cog protocol only accepts a URL string
 * (`CogReader(url)` → `geotiff.fromUrl`), so the file is exposed as an object
 * URL — `blob:` URLs answer Range requests (verified: 206 + Content-Range), which
 * is exactly what geotiff needs to read a COG's headers and tiles lazily.
 *
 * Object URLs do NOT survive a reload, so `cogUrl` is regenerated on hydration —
 * the persisted value is never trusted. See `objectUrlForCog`.
 */
export async function buildCOGFromFile(file: File, idbKey: string): Promise<COGLayerProps> {
    const objectUrl = URL.createObjectURL(file)
    const title = file.name.replace(/\.(tif|tiff)$/i, '')
    try {
        await assertRenderableCog(objectUrl, file.name)
    } catch (e) {
        // Unusable — release the URL rather than leak the file's bytes.
        URL.revokeObjectURL(objectUrl)
        throw e
    }
    return {
        type: 'cog',
        title,
        cogUrl: objectUrl,
        colorStops: DEFAULT_COG_STOPS,
        stretchMode: 'minmax',
        continuous: true,
        visible: true,
        opacity: 0.9,
        userAdded: true,
        local: true,
        idbKey,
    }
}

/** Fresh object URL for a hydrated COG upload — the persisted one is dead after reload. */
export function objectUrlForCog(file: File): string {
    return URL.createObjectURL(file)
}

/**
 * Undo the browser-side handles a built upload holds, for when the layer is
 * discarded before it is ever mounted (a failed IndexedDB write, say). Without
 * this a rejected upload keeps its file's bytes pinned via the object URL, and
 * leaves a protocol key registered that would shadow a later upload of the same
 * name.
 */
export function releaseUploadedLayer(def: UploadedLayer): void {
    if (def.type === 'cog' && def.cogUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(def.cogUrl)
    }
    if (def.type === 'pmtiles' && def.local) {
        unregisterLocalPMTiles(def.pmtilesUrl)
    }
}

/**
 * Parse an uploaded file into a layer def. Supports GeoJSON (inline data),
 * PMTiles (File-backed via the protocol) and COG (File-backed via object URL).
 * Returns the def plus the file that must be persisted — for PMTiles that is a
 * re-keyed copy, and hydration depends on persisting exactly this one so its
 * name matches `pmtilesUrl`.
 */
export async function buildLayerFromFile(
    file: File,
    idbKey: string,
    opts: { onLargeDataset?: LoadParquetOptions['onLargeDataset'] } = {},
): Promise<{ def: UploadedLayer; file: File }> {
    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(
            `"${file.name}" is ${formatBytes(file.size)}, over the ${formatBytes(MAX_UPLOAD_BYTES)} upload limit. ` +
            `Host it and add it by URL instead — remote layers stream rather than loading whole.`,
        )
    }
    const name = file.name.toLowerCase()
    if (name.endsWith('.pmtiles')) {
        return buildPMTilesFromFile(file, idbKey)
    }
    if (name.endsWith('.tif') || name.endsWith('.tiff')) {
        return { def: await buildCOGFromFile(file, idbKey), file }
    }
    if (name.endsWith('.parquet')) {
        const title = file.name.replace(/\.parquet$/i, '')
        const deckData = await loadParquetForDeck(file, { onLargeDataset: opts.onLargeDataset, name: file.name })
        const def: ParquetLayerProps = {
            type: 'parquet',
            title,
            idbKey,
            deckData,
            color: colorFromTitle(title),
            visible: true,
            opacity: 0.85,
            userAdded: true,
            local: true,
        }
        return { def, file }
    }
    if (!name.endsWith('.geojson') && !name.endsWith('.json')) {
        throw new Error('Only GeoJSON (.geojson / .json), PMTiles (.pmtiles), COG (.tif / .tiff) and GeoParquet (.parquet) files can be uploaded.')
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(await file.text())
    } catch {
        throw new Error(`"${file.name}" is not valid JSON.`)
    }
    const fc = parsed as { type?: string; features?: unknown[] }
    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        throw new Error(`"${file.name}" is not a GeoJSON FeatureCollection.`)
    }
    const title = file.name.replace(/\.(geojson|json)$/i, '')
    // GeoJSON data is inlined on the def, so the file itself needn't be persisted.
    return { def: buildGeoJSONFromData(parsed as FeatureCollection, title, idbKey), file }
}
