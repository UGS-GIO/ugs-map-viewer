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
} from '@/lib/types/mapping-types'
import {
    STAC_SERVING_TOPICS_COLLECTION,
    fetchStacItem,
    fetchStacItemIndex,
    resolveStacPMTilesLayer,
    type StacItem,
} from '@/lib/map/stac/stac-layer'
import { loadCogMetadata } from '@/hooks/use-cog-metadata'
import { registerLocalPMTiles } from '@/lib/map/pmtiles/setup'

/** A layer produced by uploading a local file (data lives in the browser, not a URL). */
export type UploadedLayer = GeoJSONLayerProps | PMTilesLayerProps | COGLayerProps

export type DetectedFormat = 'pmtiles' | 'geojson' | 'cog' | 'wms' | 'stac' | 'unknown'

/** Deterministic colour from a title so a layer keeps its colour across reloads. */
const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
export function colorFromTitle(title: string): string {
    let h = 0
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
    return PALETTE[h % PALETTE.length]
}

/** Default viridis-like ramp for user COG layers with no styling metadata. */
const DEFAULT_COG_STOPS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725']

/** A generic MapLibre style fragment (fill+line+circle) as a `data:` URL the
 *  PMTiles engine can fetch. Lets a user PMTiles render with no STAC style. */
function defaultVectorStyleUrl(sourceLayer: string, color: string): string {
    const fragment = {
        layers: [
            { id: 'user-fill', type: 'fill', 'source-layer': sourceLayer, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': 0.35 } },
            { id: 'user-line', type: 'line', 'source-layer': sourceLayer, paint: { 'line-color': color, 'line-width': 1.2 } },
            { id: 'user-circle', type: 'circle', 'source-layer': sourceLayer, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 4, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } },
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
    if (p.endsWith('.tif') || p.endsWith('.tiff')) return 'cog'
    if (qs.includes('service=wms') || p.endsWith('/wms') || p.endsWith('/wms/')) return 'wms'
    if (p.endsWith('.json')) return 'stac' // could also be GeoJSON — resolved on fetch
    return 'unknown'
}

/** Derive a display title from a URL's filename. */
export function titleFromUrl(raw: string): string {
    const [path] = raw.split('?')
    const base = path.split('/').filter(Boolean).pop() || 'layer'
    return base.replace(/\.(pmtiles|geojson|json|tif|tiff)$/i, '') || 'layer'
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

function buildGeoJSONFromData(data: FeatureCollection, title: string, idbKey: string): GeoJSONLayerProps {
    return { type: 'geojson', title, data, idbKey, color: colorFromTitle(title), visible: true, opacity: 0.8, userAdded: true, local: true }
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

async function buildFromStacItem(item: StacItem, title: string, itemHref?: string): Promise<LayerProps> {
    const hasPmtiles = !!item.assets?.pmtiles
        || Object.values(item.assets ?? {}).some(a => a.type === 'application/vnd.pmtiles')
    if (hasPmtiles) {
        return { ...resolveStacPMTilesLayer(item, { stacItemId: item.id, title, visible: true }), userAdded: true }
    }
    const cog = Object.values(item.assets ?? {}).find(
        a => a.type?.includes('image/tiff') || a.roles?.includes('data'),
    )
    // Pass the item href so the COG can fall back to the item's raster:bands stats.
    if (cog?.href) return buildCOG(cog.href, title, itemHref)
    throw new Error(`STAC item '${item.id}' has no PMTiles or COG asset to render.`)
}

/** Resolve a STAC item id (serving-topics collection) or a direct item URL. */
async function buildFromStac(input: string, title: string): Promise<LayerProps> {
    // Direct item URL?
    if (/^https?:\/\//i.test(input) && input.toLowerCase().endsWith('.json')) {
        const item = await fetchStacItem(input)
        // GeoJSON masquerading as .json (no stac_version) → treat as GeoJSON.
        if (!('stac_version' in item) && (item as unknown as { type?: string }).type === 'FeatureCollection') {
            return buildGeoJSONFromUrl(input, title)
        }
        return buildFromStacItem(item, title || item.id, input)
    }
    // Otherwise treat as an id in the serving-topics collection.
    const index = await fetchStacItemIndex()
    const href = index[input]
    if (!href) throw new Error(`STAC item id '${input}' not found in ${STAC_SERVING_TOPICS_COLLECTION}`)
    const item = await fetchStacItem(href)
    return buildFromStacItem(item, title || item.id, href)
}

export interface BuildFromUrlOptions {
    /** Override the auto title. */
    title?: string
    /** Force a format instead of sniffing. */
    format?: DetectedFormat
    /** WMS layer name (workspace:layer) when it isn't in the URL. */
    wmsLayerName?: string
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
        case 'cog': return buildCOG(raw, title)
        case 'wms': return buildWMS(raw, title, opts.wmsLayerName)
        case 'stac': return buildFromStac(raw, title)
        default:
            throw new Error(`Could not detect format for "${raw}". Supported: .pmtiles, .geojson, .tif/.tiff, WMS, or a STAC item id/URL.`)
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
 * Parse an uploaded file into a layer def. Supports GeoJSON (inline data),
 * PMTiles (File-backed via the protocol) and COG (File-backed via object URL).
 * Returns the def plus the file that must be persisted — for PMTiles that is a
 * re-keyed copy, and hydration depends on persisting exactly this one so its
 * name matches `pmtilesUrl`.
 */
export async function buildLayerFromFile(file: File, idbKey: string): Promise<{ def: UploadedLayer; file: File }> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.pmtiles')) {
        return buildPMTilesFromFile(file, idbKey)
    }
    if (name.endsWith('.tif') || name.endsWith('.tiff')) {
        return { def: await buildCOGFromFile(file, idbKey), file }
    }
    if (!name.endsWith('.geojson') && !name.endsWith('.json')) {
        throw new Error('Only GeoJSON (.geojson / .json), PMTiles (.pmtiles) and COG (.tif / .tiff) files can be uploaded.')
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
