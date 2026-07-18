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

/** Fetch the review STAC catalog items (same-origin behind IAP; the IAP cookie authenticates). */
export async function fetchReviewCatalog(): Promise<StacItem[]> {
  const res = await fetch(REVIEW_CATALOG_URL);
  if (!res.ok) throw new Error(`review-catalog ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.items) ? (data.items as StacItem[]) : [];
}

function itemTitle(item: StacItem): string {
  return (item.properties?.title as string | undefined) ?? item.id;
}

/** Build the auto-discovered "Review" group. Items without a PMTiles asset (not mappable) are skipped. */
export function reviewCatalogGroup(items: StacItem[]): GroupLayerProps | null {
  const layers: LayerProps[] = [];
  for (const item of items) {
    try {
      const layer = resolveStacPMTilesLayer(item, { stacItemId: item.id, title: itemTitle(item), visible: false });
      // Attach declarative filter controls for this layer (auto-discovery: from the registry).
      const filterFields = filterFieldsForItem(item.id);
      if (filterFields) layer.filterFields = filterFields;
      layers.push(layer);
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
