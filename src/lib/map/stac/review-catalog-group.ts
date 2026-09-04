/**
 * Auto-discovery of the review STAC catalog into map layers.
 *
 * The review app (served behind IAP at /review/app) fetches the review STAC catalog same-origin from
 * `/api/review-catalog` (review-serving crawls the `review/stac` prefix and returns the items). Every
 * mappable item becomes a PMTiles layer via the app's existing STAC resolver, and they're grouped under
 * a single auto-populated "Review" group — no hardcoded review layer list. Whatever ingest promotes into
 * the review catalog shows up automatically.
 *
 * (Generic version for arbitrary catalogs — the future `/stac` route pointed at ugs-serving-topics —
 * would traverse `catalog.json` -> child collections -> items client-side; here the server already
 * crawls, so we consume the flat item list.)
 */
import type { GroupLayerProps, LayerProps } from '@/lib/types/mapping-types';
import { resolveStacPMTilesLayer, type StacItem } from '@/lib/map/stac/stac-layer';
import { filterFieldsForItem } from '@/lib/map/layer-filters';

const REVIEW_CATALOG_URL = '/api/review-catalog';

/** Fraction of the server-reported TTL we hold a response for, leaving headroom before expiry. */
const TTL_SAFETY_FACTOR = 0.8;
/** Used when the server omits `ttl_seconds`. */
const FALLBACK_LIFETIME_MS = 5 * 60_000;

type CachedCatalog = { items: StacItem[]; expiresAt: number };

let inFlight: Promise<CachedCatalog> | null = null;

async function loadCatalog(): Promise<CachedCatalog> {
  const res = await fetch(REVIEW_CATALOG_URL);
  if (!res.ok) throw new Error(`review-catalog ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.items) ? (data.items as StacItem[]) : [];
  const ttlSeconds = Number(data?.ttl_seconds);
  const lifetime =
    Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? ttlSeconds * 1000 * TTL_SAFETY_FACTOR
      : FALLBACK_LIFETIME_MS;
  return { items, expiresAt: Date.now() + lifetime };
}

/**
 * Fetch the review STAC catalog items (same-origin behind IAP; the IAP cookie authenticates).
 *
 * Asset hrefs come back as short-lived signed GCS URLs, so the response is cached only until
 * `ttl_seconds` is nearly up — callers that read an asset (geoparquet, style JSON) after that
 * get freshly signed hrefs instead of a 403. Shared across call sites so one page load doesn't
 * re-crawl the catalog per consumer.
 */
export async function fetchReviewCatalog(): Promise<StacItem[]> {
  if (inFlight) {
    try {
      const cached = await inFlight;
      if (Date.now() < cached.expiresAt) return cached.items;
    } catch {
      // previous attempt failed — fall through and retry
    }
  }
  const pending = loadCatalog();
  inFlight = pending;
  try {
    return (await pending).items;
  } catch (err) {
    if (inFlight === pending) inFlight = null;
    throw err;
  }
}

function itemTitle(item: StacItem): string {
  return (item.properties?.title as string | undefined) ?? item.id;
}

export const DISPLACEMENT_ITEM_ID = 'hazards_displacement_contours';

/** Build the auto-discovered "Review" group. Items without a PMTiles asset (not mappable) are skipped.
 *  One catalog item = one layer, always — no per-item special cases. Displacement used to expand into 3
 *  per-type layers; its `type` is now a symbology-driving filter field (see FILTER_REGISTRY), so picking a
 *  type switches render + filter on the single layer and the sidebar matches the catalog 1:1. */
export function reviewCatalogGroup(items: StacItem[]): GroupLayerProps | null {
  const layers: LayerProps[] = [];
  for (const item of items) {
    try {
      const base = resolveStacPMTilesLayer(item, { stacItemId: item.id, title: itemTitle(item), visible: false });
      const filterFields = filterFieldsForItem(item.id);
      if (filterFields) base.filterFields = filterFields;
      layers.push(base);
    } catch {
      // no PMTiles asset on this item — not mappable, skip
    }
  }
  if (!layers.length) return null;
  return { type: 'group', title: 'Review', visible: false, layers };
}

/** Fetch + build the review group, or null if unreachable/empty (e.g. outside IAP). */
export async function fetchReviewCatalogGroup(): Promise<GroupLayerProps | null> {
  try {
    return reviewCatalogGroup(await fetchReviewCatalog());
  } catch {
    return null;
  }
}

/** renderId -> GL style URL for the review displacement item. The chart's value bins + colors are parsed
 *  from these styles (review path never touches GeoServer SLD). */
export async function fetchReviewDisplacementStyleUrls(): Promise<Record<string, string>> {
  const items = await fetchReviewCatalog();
  const item = items.find((i) => i.id === DISPLACEMENT_ITEM_ID);
  if (!item) return {};
  try {
    const base = resolveStacPMTilesLayer(item, { stacItemId: item.id, title: itemTitle(item) });
    const out: Record<string, string> = {};
    for (const r of base.renders ?? []) if (r.styleUrl) out[r.id] = r.styleUrl;
    return out;
  } catch {
    return {};
  }
}

/** The review displacement item's geoparquet asset URL (signed, same-origin) — for duckdb-wasm stats. */
export async function fetchReviewDisplacementParquetUrl(): Promise<string | null> {
  const items = await fetchReviewCatalog();
  const item = items.find((i) => i.id === DISPLACEMENT_ITEM_ID);
  if (!item) return null;
  const assets = item.assets ?? {};
  const href = assets.data?.href ?? Object.values(assets).find((a) => a?.href?.includes('.parquet'))?.href;
  return href ?? null;
}
