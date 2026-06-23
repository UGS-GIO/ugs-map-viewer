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
    ExtendedSublayerProperties,
    PMTilesLayerProps,
    PMTilesRender,
} from '@/lib/types/mapping-types';

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
        renders?: Record<string, StacRenderEntry>;
        [key: string]: unknown;
    };
    assets: Record<string, { href: string; type?: string; roles?: string[] }>;
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
    const renders = stacRendersToPMTiles(item.properties.renders);
    const sourceLayer = item.properties['ugs:layer'] ?? item.id;

    return {
        type: 'pmtiles',
        title: app.title,
        pmtilesUrl,
        sourceLayer,
        renders,
        defaultRenderId: app.defaultRenderId ?? renders[0]?.id,
        visible: app.visible ?? false,
        opacity: app.opacity ?? 0.85,
        downloadParquetUrl: parquetHref(item),
        sublayers: app.sublayers,
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
