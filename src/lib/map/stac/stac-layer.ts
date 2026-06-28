/**
 * STAC → runtime layer resolution.
 *
 * The warehouse (ugs-warehouse) publishes each serving layer as a STAC item:
 * data assets (pmtiles/parquet), projection, row count, and a `renders` block
 * (style_url + sprite + legend per symbology, attached from ugs-styles). That
 * STAC item is the single source of truth for a layer's DATA and STYLE.
 *
 * The app owns only UX that STAC doesn't model — popups, related tables, which
 * map/group a layer belongs to, default symbology, filter schema. So an app
 * layer config is a thin {@link StacLayerAppConfig} that names a STAC item id
 * and carries that UX; {@link resolveStacPMTilesLayer} merges the two into the
 * `PMTilesLayerProps` the generic renders engine already consumes.
 *
 * No style URLs, sprites, colors, or legends are hand-authored in the app.
 */
import type {
    DisplayField,
    ExtendedSublayerProperties,
    LayerProps,
    PMTilesLayerProps,
    PMTilesRender,
    RelatedTable,
} from '@/lib/types/mapping-types';
import { toTitleCase } from '@/lib/utils';

// Serving-topics collection — the vector layers the viewer can render. Items
// live at `./<id>/<id>.json` relative to this URL.
export const STAC_SERVING_TOPICS_COLLECTION =
    'https://maps-assets.geology.utah.gov/warehouse/stac/ugs-serving-topics/collection.json';

/** One entry of a STAC item's `renders` extension (warehouse-attached). */
export interface StacRenderEntry {
    title?: string;
    /** Asset keys this render targets (e.g. ['pmtiles']). */
    assets?: string[];
    /** Absolute URL to the MapLibre style fragment (`{ layers: [...] }`). */
    style_url?: string;
    /** Absolute sprite-sheet base URL (no extension) for icon renders. */
    sprite?: string;
    /** Legend swatches; icon renders carry this explicitly. */
    legend?: Array<{ label: string; color: string }>;
}

/** The slice of a STAC item we depend on. Extra fields are ignored. */
export interface StacItem {
    id: string;
    bbox?: number[];
    properties: {
        'ugs:layer'?: string;
        'proj:code'?: string;
        'ugs:row_count'?: number;
        /** Renders block. Warehouse emits it namespaced as `ugs:renders`; older items used `renders`. */
        'ugs:renders'?: Record<string, StacRenderEntry>;
        renders?: Record<string, StacRenderEntry>;
        [key: string]: unknown;
    };
    assets: Record<string, {
        href: string;
        type?: string;
        roles?: string[];
        title?: string;
        /** Join metadata for related-data assets (roles include 'related'). */
        'ugs:foreign_keys'?: Array<{ fields: string[]; reference: { resource: string; fields: string[] } }>;
        /** Column schema for related-data assets, used to default displayFields. */
        'table:columns'?: Array<{ name: string; type?: string }>;
    }>;
}

/**
 * App-owned layer UX that STAC does not model. Pairs with a STAC item id to
 * produce a runtime layer.
 */
export interface StacLayerAppConfig {
    /** STAC item id (e.g. 'enmin_ucrc_wells'). */
    stacItemId: string;
    /** Display title in the layer list / used as the map layer key. */
    title: string;
    /** Render id shown initially (defaults to the first render). */
    defaultRenderId?: string;
    visible?: boolean;
    opacity?: number;
    /** Popups + related tables (UX, not in STAC). */
    sublayers?: ExtendedSublayerProperties[];
}

/** PMTiles asset is required to render; fall back across a couple of common keys. */
function pmtilesHref(item: StacItem): string | undefined {
    return item.assets?.pmtiles?.href
        ?? Object.values(item.assets ?? {}).find(a => a.type === 'application/vnd.pmtiles')?.href;
}

/** GeoParquet data asset, used for client-side export. */
function parquetHref(item: StacItem): string | undefined {
    return item.assets?.data?.href
        ?? Object.values(item.assets ?? {}).find(a => a.type === 'application/vnd.apache.parquet')?.href;
}

/** Default displayFields from a related asset's table:columns (drop join/pk columns). */
function defaultDisplayFields(
    columns: Array<{ name: string }> | undefined,
    matchingField: string,
): DisplayField[] | undefined {
    if (!columns?.length) return undefined;
    return columns
        .filter(c => c.name !== matchingField && c.name !== 'pk' && !c.name.endsWith('_pk'))
        .map(c => ({ field: c.name, label: toTitleCase(c.name.replace(/_/g, ' ')) }));
}

/**
 * Resolve one STAC-backed related table (an app entry tagged with `stacAsset`) against
 * the item's `roles:['related']` asset: fill url(=parquet href) + join (from ugs:foreign_keys)
 * + fetchMode 'parquet', then keep all app-authored presentation. Returns null (logged) if the
 * asset is missing or lacks join metadata, so a broken table is dropped rather than half-built.
 * Legacy entries (no `stacAsset`) are passed through untouched by the caller.
 */
function resolveStacRelatedTable(rt: RelatedTable, item: StacItem): RelatedTable | null {
    const asset = item.assets?.[rt.stacAsset!];
    if (!asset?.href || !asset.roles?.includes('related')) {
        console.error(`[stac] related asset '${rt.stacAsset}' not found (or not role 'related') on item '${item.id}'`);
        return null;
    }
    const fk = asset['ugs:foreign_keys']?.[0];
    const matchingField = rt.matchingField ?? fk?.fields?.[0];
    const targetField = rt.targetField ?? fk?.reference?.fields?.[0];
    if (!matchingField || !targetField) {
        console.error(`[stac] related asset '${rt.stacAsset}' on '${item.id}' has no ugs:foreign_keys; cannot join`);
        return null;
    }
    return {
        ...rt,
        url: asset.href,
        fetchMode: 'parquet',
        matchingField,
        targetField,
        headers: rt.headers ?? {},
        fieldLabel: rt.fieldLabel ?? asset.title ?? rt.stacAsset!,
        displayFields: rt.displayFields ?? defaultDisplayFields(asset['table:columns'], matchingField),
    };
}

/**
 * For each sublayer, resolve any STAC-backed related tables against the item; legacy
 * (url-based) entries pass through. Shared by both resolver paths so they can't drift.
 */
function resolveSublayerRelatedTables(
    sublayers: ExtendedSublayerProperties[] | undefined,
    item: StacItem,
): ExtendedSublayerProperties[] | undefined {
    if (!sublayers) return sublayers;
    return sublayers.map(sub => {
        if (!sub.relatedTables?.length) return sub;
        const relatedTables = sub.relatedTables
            .map(rt => (rt.stacAsset ? resolveStacRelatedTable(rt, item) : rt))
            .filter((rt): rt is RelatedTable => rt != null);
        return { ...sub, relatedTables };
    });
}

/**
 * Map a STAC item's `renders` block to the engine's {@link PMTilesRender} list.
 * Only renders that target the pmtiles asset and carry a style_url are kept.
 * Order follows the object's key order (the warehouse emits a stable order).
 */
export function stacRendersToPMTiles(renders: Record<string, StacRenderEntry> | undefined): PMTilesRender[] {
    if (!renders) return [];
    const out: PMTilesRender[] = [];
    for (const [id, r] of Object.entries(renders)) {
        if (!r.style_url) continue;
        if (r.assets && !r.assets.includes('pmtiles')) continue;
        out.push({ id, title: r.title, styleUrl: r.style_url, sprite: r.sprite, legend: r.legend });
    }
    return out;
}

/**
 * Merge a resolved STAC item with the app's UX config into the runtime
 * `PMTilesLayerProps` consumed by the generic renders engine. Throws if the
 * item lacks a PMTiles asset (can't render).
 */
export function resolveStacPMTilesLayer(item: StacItem, app: StacLayerAppConfig): PMTilesLayerProps {
    const pmtilesUrl = pmtilesHref(item);
    if (!pmtilesUrl) {
        throw new Error(`STAC item '${item.id}' has no PMTiles asset; cannot render '${app.title}'.`);
    }
    const renders = stacRendersToPMTiles(item.properties['ugs:renders'] ?? item.properties.renders);

    return {
        type: 'pmtiles',
        title: app.title,
        pmtilesUrl,
        // PMTiles vector source-layer is named after the STAC item id (warehouse
        // convention), NOT `ugs:layer` (which is the DB view, e.g. `*_current`).
        sourceLayer: item.id,
        renders,
        defaultRenderId: app.defaultRenderId ?? renders[0]?.id,
        visible: app.visible ?? false,
        opacity: app.opacity ?? 0.85,
        downloadParquetUrl: parquetHref(item),
        sublayers: resolveSublayerRelatedTables(app.sublayers, item),
    };
}

/**
 * Symbology-selector options for a layer, derived from its STAC renders. The
 * `id` is what gets written to `vector_symbology[title]`; `label` is shown in
 * the "Symbolize by" control. Replaces hand-coded Purpose/Box-Type option lists.
 */
export function renderSelectOptions(layer: PMTilesLayerProps): Array<{ id: string; label: string }> {
    return (layer.renders ?? []).map(r => ({ id: r.id, label: r.title ?? r.id }));
}

// ─── Catalog fetch + tree resolution ───────────────────────────────────────

interface StacCollection {
    links?: Array<{ rel: string; href: string; title?: string }>;
}

/**
 * Fetch the serving-topics collection and build `itemId → absolute item URL`
 * from its `item` links (relative hrefs resolved against the collection URL).
 */
export async function fetchStacItemIndex(): Promise<Record<string, string>> {
    const res = await fetch(STAC_SERVING_TOPICS_COLLECTION);
    if (!res.ok) throw new Error(`STAC collection fetch failed: ${res.status}`);
    const collection: StacCollection = await res.json();
    const index: Record<string, string> = {};
    for (const link of collection.links ?? []) {
        if (link.rel !== 'item' || !link.href) continue;
        const href = new URL(link.href, STAC_SERVING_TOPICS_COLLECTION).toString();
        const id = href.split('/').pop()?.replace(/\.json$/, '');
        if (id) index[id] = href;
    }
    return index;
}

export async function fetchStacItem(href: string): Promise<StacItem> {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`STAC item fetch failed: ${res.status}`);
    return res.json();
}

/**
 * Resolve a single asset's href on a STAC item (e.g. a related geoparquet). Used by
 * components that need a specific asset URL outside the layer-resolution flow, e.g. the
 * box-photos cell reading the photos parquet by box_pk. Cache via react-query at the call site.
 */
export async function fetchStacAssetHref(stacItemId: string, assetKey: string): Promise<string | undefined> {
    const index = await fetchStacItemIndex();
    const href = index[stacItemId];
    if (!href) return undefined;
    const item = await fetchStacItem(href);
    return item.assets?.[assetKey]?.href;
}

/** Collect every `stacItemId` referenced in a (possibly nested) layer tree. */
function collectStacItemIds(layers: LayerProps[], into: Set<string>): void {
    for (const layer of layers) {
        if (layer.type === 'pmtiles' && (layer as PMTilesLayerProps).stacItemId) {
            into.add((layer as PMTilesLayerProps).stacItemId!);
        }
        if ('layers' in layer && Array.isArray(layer.layers)) {
            collectStacItemIds(layer.layers, into);
        }
    }
}

/**
 * Fill a STAC-backed PMTiles config's data/style fields from its resolved STAC
 * item, keeping all app-authored UX (title, sublayers, visibility, opacity…).
 */
function mergeStacIntoLayer(layer: PMTilesLayerProps, item: StacItem): PMTilesLayerProps {
    const pmtilesUrl = pmtilesHref(item);
    if (!pmtilesUrl) throw new Error(`STAC item '${item.id}' has no PMTiles asset`);
    const renders = stacRendersToPMTiles(item.properties['ugs:renders'] ?? item.properties.renders);
    return {
        ...layer,
        pmtilesUrl,
        // Tile source-layer = STAC item id (warehouse convention), authoritative
        // over any app-provided value.
        sourceLayer: item.id,
        renders: renders.length > 0 ? renders : layer.renders,
        defaultRenderId: layer.defaultRenderId ?? renders[0]?.id,
        downloadParquetUrl: layer.downloadParquetUrl ?? parquetHref(item),
        sublayers: resolveSublayerRelatedTables(layer.sublayers, item),
    };
}

/**
 * Resolve every STAC-backed layer in a config tree against the warehouse
 * catalog, in place of the app hand-authoring pmtiles URLs / styles. Layers
 * without `stacItemId` pass through untouched, so maps that reference no STAC
 * items make zero network calls. A layer whose item fails to resolve is dropped
 * (logged) rather than failing the whole config load.
 */
export async function resolveStacLayerTree(layers: LayerProps[]): Promise<LayerProps[]> {
    const ids = new Set<string>();
    collectStacItemIds(layers, ids);
    if (ids.size === 0) return layers;

    const index = await fetchStacItemIndex();
    const items = new Map<string, StacItem>();
    await Promise.all([...ids].map(async (id) => {
        try {
            const href = index[id];
            if (!href) throw new Error(`'${id}' not in serving-topics collection`);
            items.set(id, await fetchStacItem(href));
        } catch (err) {
            console.error(`[resolveStacLayerTree] failed to resolve STAC item '${id}':`, err);
        }
    }));

    const mapTree = (list: LayerProps[]): LayerProps[] => {
        const out: LayerProps[] = [];
        for (const layer of list) {
            if ('layers' in layer && Array.isArray(layer.layers)) {
                out.push({ ...layer, layers: mapTree(layer.layers) } as LayerProps);
                continue;
            }
            const stacId = layer.type === 'pmtiles' ? (layer as PMTilesLayerProps).stacItemId : undefined;
            if (!stacId) { out.push(layer); continue; }
            const item = items.get(stacId);
            if (!item) { console.warn(`[resolveStacLayerTree] dropping unresolved STAC layer '${layer.title}'`); continue; }
            try {
                out.push(mergeStacIntoLayer(layer as PMTilesLayerProps, item));
            } catch (err) {
                console.error(`[resolveStacLayerTree] merge failed for '${layer.title}':`, err);
            }
        }
        return out;
    };
    return mapTree(layers);
}
